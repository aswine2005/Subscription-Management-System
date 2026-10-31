import apiClient from './client';
import { Discount } from '../types';
import { mockStore } from './mockStore';

export const discountsApi = {
  getDiscounts: async (): Promise<Discount[]> => {
    try {
      const res = await apiClient.get<any[]>('/discounts/');
      return res.data.map((d: any) => ({
        id: String(d.id),
        name: d.name,
        code: d.code,
        type: d.type || (d.discount_type === 'percentage' ? 'percentage' : 'fixed'),
        value: d.value || d.amount,
        min_purchase: d.min_purchase_amount || d.min_purchase || 0,
        start_date: d.valid_from || d.start_date,
        end_date: d.valid_until || d.end_date,
        max_uses: d.max_redemptions || d.max_uses,
        used_count: d.times_redeemed || d.used_count || 0,
        status: d.is_active !== false ? 'active' : 'disabled',
        created_at: d.created_at,
      }));
    } catch {
      return mockStore.getDiscounts();
    }
  },

  getDiscountById: async (id: string): Promise<Discount> => {
    try {
      const res = await apiClient.get<any>(`/discounts/${id}`);
      const d = res.data;
      return {
        id: String(d.id),
        name: d.name,
        code: d.code,
        type: d.type || (d.discount_type === 'percentage' ? 'percentage' : 'fixed'),
        value: d.value || d.amount,
        min_purchase: d.min_purchase_amount || d.min_purchase || 0,
        start_date: d.valid_from || d.start_date,
        end_date: d.valid_until || d.end_date,
        max_uses: d.max_redemptions || d.max_uses,
        used_count: d.times_redeemed || d.used_count || 0,
        status: d.is_active !== false ? 'active' : 'disabled',
        created_at: d.created_at,
      };
    } catch {
      const disc = mockStore.getDiscounts().find((d) => d.id === id);
      if (!disc) throw new Error('Discount not found');
      return disc;
    }
  },

  createDiscount: async (data: Omit<Discount, 'id' | 'used_count' | 'created_at'>): Promise<Discount> => {
    try {
      const res = await apiClient.post<any>('/discounts/', {
        name: data.name,
        code: data.code,
        discount_type: data.type,
        amount: data.value,
        min_purchase_amount: data.min_purchase,
        valid_from: data.start_date,
        valid_until: data.end_date,
        max_redemptions: data.max_uses,
        is_active: data.status === 'active',
      });
      return await discountsApi.getDiscountById(String(res.data.id));
    } catch {
      const discounts = mockStore.getDiscounts();
      const newDiscount: Discount = {
        ...data,
        id: `disc_${Date.now()}`,
        used_count: 0,
        created_at: new Date().toISOString(),
      };
      discounts.unshift(newDiscount);
      mockStore.saveDiscounts(discounts);
      return newDiscount;
    }
  },

  updateDiscount: async (id: string, data: Partial<Discount>): Promise<Discount> => {
    try {
      await apiClient.put<any>(`/discounts/${id}`, {
        name: data.name,
        code: data.code,
        discount_type: data.type,
        amount: data.value,
        min_purchase_amount: data.min_purchase,
        valid_from: data.start_date,
        valid_until: data.end_date,
        max_redemptions: data.max_uses,
        is_active: data.status ? data.status === 'active' : undefined,
      });
      return await discountsApi.getDiscountById(id);
    } catch {
      const discounts = mockStore.getDiscounts();
      const index = discounts.findIndex((d) => d.id === id);
      if (index === -1) throw new Error('Discount not found');

      const updated = { ...discounts[index], ...data };
      discounts[index] = updated;
      mockStore.saveDiscounts(discounts);
      return updated;
    }
  },

  deleteDiscount: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/discounts/${id}`);
    } catch {
      const discounts = mockStore.getDiscounts().filter((d) => d.id !== id);
      mockStore.saveDiscounts(discounts);
    }
  },
};
