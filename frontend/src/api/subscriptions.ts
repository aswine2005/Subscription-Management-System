import apiClient from './client';
import { Subscription, SubscriptionStatus } from '../types';
import { mockStore } from './mockStore';

export const subscriptionsApi = {
  getSubscriptions: async (params?: {
    status?: string;
    customer_id?: string;
    search?: string;
  }): Promise<Subscription[]> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.status && params.status !== 'all') queryParams.append('status', params.status);
      if (params?.customer_id) queryParams.append('customer_id', params.customer_id);
      if (params?.search) queryParams.append('search', params.search);

      const res = await apiClient.get<any[]>('/subscriptions/', { params: queryParams });
      return res.data.map((sub: any) => ({
        id: String(sub.id),
        subscription_number: sub.subscription_number,
        customer_id: String(sub.customer_id),
        customer_name: sub.customer?.full_name || sub.customer_name || 'Customer',
        customer_email: sub.customer?.email || sub.customer_email || 'client@example.com',
        plan_id: String(sub.plan_id),
        plan_name: sub.plan?.name || sub.plan_name || 'Plan Tier',
        status: sub.status,
        start_date: sub.start_date,
        expiry_date: sub.expiry_date,
        billing_cycle: sub.plan?.billing_cycle || sub.billing_cycle || 'monthly',
        payment_terms: sub.payment_terms || 'Net 30',
        lines: (sub.lines || []).map((l: any, idx: number) => ({
          id: String(l.id || idx),
          product_id: String(l.product_id),
          product_name: l.product?.name || l.product_name || 'Service',
          variant_id: l.variant_id ? String(l.variant_id) : undefined,
          variant_name: l.variant?.name || l.variant_name,
          quantity: l.quantity,
          unit_price: l.unit_price,
          subtotal: l.subtotal || l.quantity * l.unit_price,
        })),
        subtotal: sub.subtotal || 0,
        tax_amount: sub.tax_amount || 0,
        discount_amount: sub.discount_amount || 0,
        total_amount: sub.total || sub.total_amount || 0,
        quotation_template: sub.quotation_template,
        notes: sub.notes,
        created_at: sub.created_at,
      }));
    } catch {
      let subs = mockStore.getSubscriptions();
      if (params?.status && params.status !== 'all') {
        subs = subs.filter((s) => s.status === params.status);
      }
      if (params?.customer_id) {
        subs = subs.filter((s) => s.customer_id === params.customer_id);
      }
      if (params?.search) {
        const query = params.search.toLowerCase();
        subs = subs.filter(
          (s) =>
            s.subscription_number.toLowerCase().includes(query) ||
            s.customer_name?.toLowerCase().includes(query) ||
            s.plan_name?.toLowerCase().includes(query)
        );
      }
      return subs;
    }
  },

  getSubscriptionById: async (id: string): Promise<Subscription> => {
    try {
      const res = await apiClient.get<any>(`/subscriptions/${id}`);
      const sub = res.data;
      return {
        id: String(sub.id),
        subscription_number: sub.subscription_number,
        customer_id: String(sub.customer_id),
        customer_name: sub.customer?.full_name || sub.customer_name || 'Customer',
        customer_email: sub.customer?.email || sub.customer_email || 'client@example.com',
        plan_id: String(sub.plan_id),
        plan_name: sub.plan?.name || sub.plan_name || 'Plan Tier',
        status: sub.status,
        start_date: sub.start_date,
        expiry_date: sub.expiry_date,
        billing_cycle: sub.plan?.billing_cycle || sub.billing_cycle || 'monthly',
        payment_terms: sub.payment_terms || 'Net 30',
        lines: (sub.lines || []).map((l: any, idx: number) => ({
          id: String(l.id || idx),
          product_id: String(l.product_id),
          product_name: l.product?.name || l.product_name || 'Service',
          variant_id: l.variant_id ? String(l.variant_id) : undefined,
          variant_name: l.variant?.name || l.variant_name,
          quantity: l.quantity,
          unit_price: l.unit_price,
          subtotal: l.subtotal || l.quantity * l.unit_price,
        })),
        subtotal: sub.subtotal || 0,
        tax_amount: sub.tax_amount || 0,
        discount_amount: sub.discount_amount || 0,
        total_amount: sub.total || sub.total_amount || 0,
        quotation_template: sub.quotation_template,
        notes: sub.notes,
        created_at: sub.created_at,
      };
    } catch {
      const sub = mockStore.getSubscriptions().find((s) => s.id === id);
      if (!sub) throw new Error('Subscription not found');
      return sub;
    }
  },

  createSubscription: async (data: Partial<Subscription>): Promise<Subscription> => {
    try {
      const res = await apiClient.post<any>('/subscriptions/', {
        customer_id: Number(data.customer_id) || data.customer_id,
        plan_id: Number(data.plan_id) || data.plan_id,
        start_date: data.start_date,
        expiry_date: data.expiry_date,
        payment_terms: data.payment_terms,
        notes: data.notes,
        lines: (data.lines || []).map((l) => ({
          product_id: Number(l.product_id) || l.product_id,
          variant_id: l.variant_id ? Number(l.variant_id) || l.variant_id : undefined,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
      });
      return await subscriptionsApi.getSubscriptionById(String(res.data.id));
    } catch {
      const subs = mockStore.getSubscriptions();
      const users = mockStore.getUsers();
      const plans = mockStore.getPlans();

      const customer = users.find((u) => u.id === data.customer_id);
      const plan = plans.find((p) => p.id === data.plan_id);

      const subtotal = (data.lines || []).reduce(
        (acc, line) => acc + (line.unit_price || 0) * (line.quantity || 1),
        0
      );
      const tax_amount = Math.round(subtotal * 0.1 * 100) / 100;
      const discount_amount = data.discount_amount || 0;
      const total_amount = Math.max(0, subtotal + tax_amount - discount_amount);

      const newSub: Subscription = {
        id: `sub_${Date.now()}`,
        subscription_number: `SUB-2026-${String(subs.length + 1).padStart(3, '0')}`,
        customer_id: data.customer_id || '',
        customer_name: customer?.name || data.customer_name || 'Acme Customer',
        customer_email: customer?.email || data.customer_email || 'client@example.com',
        plan_id: data.plan_id || '',
        plan_name: plan?.name || data.plan_name || 'Standard Plan',
        status: (data.status as SubscriptionStatus) || 'draft',
        start_date: data.start_date || new Date().toISOString().split('T')[0],
        expiry_date: data.expiry_date || new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
        billing_cycle: data.billing_cycle || plan?.billing_cycle || 'monthly',
        payment_terms: data.payment_terms || 'Net 30',
        lines: data.lines || [],
        subtotal,
        tax_amount,
        discount_amount,
        total_amount,
        quotation_template: data.quotation_template,
        notes: data.notes,
        created_at: new Date().toISOString(),
      };

      subs.unshift(newSub);
      mockStore.saveSubscriptions(subs);
      return newSub;
    }
  },

  updateSubscription: async (id: string, data: Partial<Subscription>): Promise<Subscription> => {
    try {
      const res = await apiClient.put<any>(`/subscriptions/${id}`, data);
      return await subscriptionsApi.getSubscriptionById(id);
    } catch {
      const subs = mockStore.getSubscriptions();
      const index = subs.findIndex((s) => s.id === id);
      if (index === -1) throw new Error('Subscription not found');

      const updated = { ...subs[index], ...data };
      subs[index] = updated;
      mockStore.saveSubscriptions(subs);
      return updated;
    }
  },

  advanceStatus: async (id: string): Promise<Subscription> => {
    try {
      // Backend transition endpoint: POST /subscriptions/{id}/status
      const current = await subscriptionsApi.getSubscriptionById(id);
      const nextStatusMap: Record<SubscriptionStatus, SubscriptionStatus> = {
        draft: 'quotation',
        quotation: 'confirmed',
        confirmed: 'active',
        active: 'active',
        paused: 'active',
        closed: 'closed',
      };
      const nextTarget = nextStatusMap[current.status] || current.status;
      await apiClient.post(`/subscriptions/${id}/status`, { new_status: nextTarget });
      return await subscriptionsApi.getSubscriptionById(id);
    } catch {
      const subs = mockStore.getSubscriptions();
      const index = subs.findIndex((s) => s.id === id);
      if (index === -1) throw new Error('Subscription not found');

      const statusMap: Record<SubscriptionStatus, SubscriptionStatus> = {
        draft: 'quotation',
        quotation: 'confirmed',
        confirmed: 'active',
        active: 'active',
        paused: 'active',
        closed: 'closed',
      };

      subs[index].status = statusMap[subs[index].status] || subs[index].status;
      mockStore.saveSubscriptions(subs);
      return subs[index];
    }
  },

  pauseSubscription: async (id: string): Promise<Subscription> => {
    try {
      const current = await subscriptionsApi.getSubscriptionById(id);
      if (current.status === 'paused') {
        await apiClient.post(`/subscriptions/${id}/resume`);
      } else {
        await apiClient.post(`/subscriptions/${id}/pause`);
      }
      return await subscriptionsApi.getSubscriptionById(id);
    } catch {
      const subs = mockStore.getSubscriptions();
      const index = subs.findIndex((s) => s.id === id);
      if (index === -1) throw new Error('Subscription not found');

      subs[index].status = subs[index].status === 'paused' ? 'active' : 'paused';
      mockStore.saveSubscriptions(subs);
      return subs[index];
    }
  },

  closeSubscription: async (id: string): Promise<Subscription> => {
    try {
      await apiClient.post(`/subscriptions/${id}/close`);
      return await subscriptionsApi.getSubscriptionById(id);
    } catch {
      const subs = mockStore.getSubscriptions();
      const index = subs.findIndex((s) => s.id === id);
      if (index === -1) throw new Error('Subscription not found');

      subs[index].status = 'closed';
      mockStore.saveSubscriptions(subs);
      return subs[index];
    }
  },
};
