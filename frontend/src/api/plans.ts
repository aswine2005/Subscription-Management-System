import apiClient from './client';
import { Plan } from '../types';
import { mockStore } from './mockStore';

export const plansApi = {
  getPlans: async (product_id?: string, billing_cycle?: string): Promise<Plan[]> => {
    try {
      const params = new URLSearchParams();
      if (product_id && product_id !== 'all') params.append('product_id', product_id);
      if (billing_cycle && billing_cycle !== 'all') params.append('billing_cycle', billing_cycle);
      const res = await apiClient.get<any[]>('/plans/', { params });
      return res.data.map((p: any) => ({
        id: String(p.id),
        name: p.name,
        product_id: String(p.product_id),
        product_name: p.product?.name || p.product_name || 'Standard Product',
        billing_cycle: p.billing_cycle,
        price: p.price,
        min_qty: p.min_qty,
        auto_close: p.auto_close,
        allow_early_close: p.allow_early_close,
        allow_pause: p.allow_pause,
        allow_renewal: p.allow_renewal,
        status: p.is_active !== false ? 'active' : 'archived',
        description: p.description,
        created_at: p.created_at,
      }));
    } catch {
      let plans = mockStore.getPlans();
      if (product_id && product_id !== 'all') {
        plans = plans.filter((p) => p.product_id === product_id);
      }
      if (billing_cycle && billing_cycle !== 'all') {
        plans = plans.filter((p) => p.billing_cycle === billing_cycle);
      }
      return plans;
    }
  },

  getPlanById: async (id: string): Promise<Plan> => {
    try {
      const res = await apiClient.get<any>(`/plans/${id}`);
      const p = res.data;
      return {
        id: String(p.id),
        name: p.name,
        product_id: String(p.product_id),
        product_name: p.product?.name || p.product_name || 'Standard Product',
        billing_cycle: p.billing_cycle,
        price: p.price,
        min_qty: p.min_qty,
        auto_close: p.auto_close,
        allow_early_close: p.allow_early_close,
        allow_pause: p.allow_pause,
        allow_renewal: p.allow_renewal,
        status: p.is_active !== false ? 'active' : 'archived',
        description: p.description,
        created_at: p.created_at,
      };
    } catch {
      const plan = mockStore.getPlans().find((p) => p.id === id);
      if (!plan) throw new Error('Plan not found');
      return plan;
    }
  },

  createPlan: async (data: Omit<Plan, 'id' | 'created_at'>): Promise<Plan> => {
    try {
      const res = await apiClient.post<any>('/plans/', {
        name: data.name,
        product_id: Number(data.product_id) || data.product_id,
        billing_cycle: data.billing_cycle,
        price: data.price,
        min_qty: data.min_qty,
        auto_close: data.auto_close,
        allow_early_close: data.allow_early_close,
        allow_pause: data.allow_pause,
        allow_renewal: data.allow_renewal,
        description: data.description,
        is_active: data.status === 'active',
      });
      return await plansApi.getPlanById(String(res.data.id));
    } catch {
      const plans = mockStore.getPlans();
      const products = mockStore.getProducts();
      const product = products.find((p) => p.id === data.product_id);

      const newPlan: Plan = {
        ...data,
        id: `plan_${Date.now()}`,
        product_name: product?.name || 'Standard Product',
        created_at: new Date().toISOString(),
      };
      plans.unshift(newPlan);
      mockStore.savePlans(plans);
      return newPlan;
    }
  },

  updatePlan: async (id: string, data: Partial<Plan>): Promise<Plan> => {
    try {
      await apiClient.put<any>(`/plans/${id}`, {
        name: data.name,
        product_id: data.product_id ? Number(data.product_id) || data.product_id : undefined,
        billing_cycle: data.billing_cycle,
        price: data.price,
        min_qty: data.min_qty,
        auto_close: data.auto_close,
        allow_early_close: data.allow_early_close,
        allow_pause: data.allow_pause,
        allow_renewal: data.allow_renewal,
        description: data.description,
        is_active: data.status ? data.status === 'active' : undefined,
      });
      return await plansApi.getPlanById(id);
    } catch {
      const plans = mockStore.getPlans();
      const index = plans.findIndex((p) => p.id === id);
      if (index === -1) throw new Error('Plan not found');
      const products = mockStore.getProducts();
      const product = data.product_id ? products.find((p) => p.id === data.product_id) : undefined;

      const updated: Plan = {
        ...plans[index],
        ...data,
        product_name: product ? product.name : plans[index].product_name,
      };
      plans[index] = updated;
      mockStore.savePlans(plans);
      return updated;
    }
  },

  deletePlan: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/plans/${id}`);
    } catch {
      const plans = mockStore.getPlans().filter((p) => p.id !== id);
      mockStore.savePlans(plans);
    }
  },
};
