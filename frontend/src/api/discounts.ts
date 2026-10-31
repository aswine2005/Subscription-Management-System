import apiClient, { listAll, dateTime } from './client';
import { Discount } from '../types';
import { mapDiscount } from './mappers';
const payload = (d: Partial<Discount>) => ({
  ...d,
  min_purchase_amount: d.min_purchase,
  start_date: dateTime(d.start_date),
  end_date: dateTime(d.end_date) || null,
  max_uses: d.max_uses || null,
  product_id: d.product_id ? Number(d.product_id) : null,
  is_active: d.status ? d.status === 'active' : undefined,
});
export const discountsApi = {
  getDiscounts: async (): Promise<Discount[]> => (await listAll('/discounts/')).map(mapDiscount),
  getDiscountById: async (id: string) =>
    mapDiscount((await apiClient.get(`/discounts/${id}`)).data),
  createDiscount: async (d: Omit<Discount, 'id' | 'used_count' | 'created_at'>) =>
    mapDiscount((await apiClient.post('/discounts/', payload(d))).data),
  updateDiscount: async (id: string, d: Partial<Discount>) =>
    mapDiscount((await apiClient.put(`/discounts/${id}`, payload(d))).data),
  deleteDiscount: async (id: string) => {
    await apiClient.delete(`/discounts/${id}`);
  },
};
