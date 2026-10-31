import apiClient, { listAll, dateTime, matches } from './client';
import { Subscription, SubscriptionStatus } from '../types';
import { mapSubscription } from './mappers';
export const subscriptionsApi = {
  getSubscriptions: async (params?: {
    status?: string;
    customer_id?: string;
    search?: string;
  }): Promise<Subscription[]> =>
    (
      await listAll('/subscriptions/', {
        status: params?.status === 'all' ? undefined : params?.status,
        customer_id: params?.customer_id,
      })
    )
      .map(mapSubscription)
      .filter((s) =>
        matches(`${s.subscription_number} ${s.customer_name} ${s.plan_name}`, params?.search),
      ),
  getSubscriptionById: async (id: string) =>
    mapSubscription((await apiClient.get(`/subscriptions/${id}`)).data),
  createSubscription: async (d: Partial<Subscription>) =>
    mapSubscription(
      (
        await apiClient.post('/subscriptions/', {
          ...d,
          customer_id: Number(d.customer_id),
          plan_id: Number(d.plan_id),
          start_date: dateTime(d.start_date),
          expiry_date: dateTime(d.expiry_date),
          lines: d.lines?.map((l) => ({
            ...l,
            product_id: Number(l.product_id),
            variant_id: l.variant_id ? Number(l.variant_id) : null,
          })),
        })
      ).data,
    ),
  advanceStatus: async (id: string) => {
    const s = await subscriptionsApi.getSubscriptionById(id);
    const next: Record<SubscriptionStatus, SubscriptionStatus> = {
      draft: 'quotation',
      quotation: 'confirmed',
      confirmed: 'active',
      active: 'active',
      paused: 'active',
      closed: 'closed',
    };
    return mapSubscription(
      (await apiClient.post(`/subscriptions/${id}/transition`, { target_status: next[s.status] }))
        .data,
    );
  },
  pauseSubscription: async (id: string) => {
    const s = await subscriptionsApi.getSubscriptionById(id);
    return mapSubscription(
      (await apiClient.post(`/subscriptions/${id}/${s.status === 'paused' ? 'resume' : 'pause'}`))
        .data,
    );
  },
  closeSubscription: async (id: string) =>
    mapSubscription((await apiClient.post(`/subscriptions/${id}/close`)).data),
  renewSubscription: async (id: string) =>
    mapSubscription((await apiClient.post(`/subscriptions/${id}/renew`)).data),
};
