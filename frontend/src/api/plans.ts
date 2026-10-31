import apiClient, { listAll, dateTime } from './client';
import { Plan } from '../types';
import { mapPlan } from './mappers';
const payload = (d: Partial<Plan>) => ({
  ...d,
  product_id: d.product_id ? Number(d.product_id) : undefined,
  min_quantity: d.min_qty,
  available_from: dateTime(d.available_from),
  available_to: dateTime(d.available_to) || null,
  is_active: d.status ? d.status === 'active' : undefined,
});
export const plansApi = {
  getPlans: async (product_id?: string, billing_cycle?: string): Promise<Plan[]> =>
    (await listAll('/plans/'))
      .map(mapPlan)
      .filter(
        (p) =>
          (!product_id || product_id === 'all' || p.product_id === product_id) &&
          (!billing_cycle || billing_cycle === 'all' || p.billing_cycle === billing_cycle),
      ),
  getPlanById: async (id: string) => mapPlan((await apiClient.get(`/plans/${id}`)).data),
  createPlan: async (data: Omit<Plan, 'id' | 'created_at'>) =>
    mapPlan((await apiClient.post('/plans/', payload(data))).data),
  updatePlan: async (id: string, data: Partial<Plan>) =>
    mapPlan((await apiClient.put(`/plans/${id}`, payload(data))).data),
  deletePlan: async (id: string) => {
    await apiClient.delete(`/plans/${id}`);
  },
};
