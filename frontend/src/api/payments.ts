import apiClient from './client';
import { PaymentRecord } from '../types';
import { mockStore } from './mockStore';

export const paymentsApi = {
  getPayments: async (params?: {
    method?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<PaymentRecord[]> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.method && params.method !== 'all') queryParams.append('payment_method', params.method);
      if (params?.search) queryParams.append('search', params.search);

      const res = await apiClient.get<any[]>('/payments/', { params: queryParams });
      return res.data.map((p: any) => ({
        id: String(p.id),
        invoice_id: String(p.invoice_id),
        invoice_number: p.invoice_number || (p.invoice?.invoice_number ? p.invoice.invoice_number : `INV-${p.invoice_id}`),
        customer_id: String(p.invoice?.customer_id || p.customer_id || 'usr'),
        customer_name: p.customer_name || p.invoice?.customer?.full_name || 'Customer',
        amount: p.amount,
        payment_method: p.payment_method,
        payment_date: p.payment_date,
        reference_number: p.payment_number || p.reference_number,
        notes: p.notes,
        status: p.status || 'completed',
        created_at: p.created_at,
      }));
    } catch {
      let payments = mockStore.getPayments();
      if (params?.method && params.method !== 'all') {
        payments = payments.filter((p) => p.payment_method === params.method);
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        payments = payments.filter(
          (p) =>
            p.invoice_number?.toLowerCase().includes(q) ||
            p.customer_name?.toLowerCase().includes(q) ||
            p.reference_number?.toLowerCase().includes(q)
        );
      }
      return payments;
    }
  },

  getPaymentById: async (id: string): Promise<PaymentRecord> => {
    try {
      const res = await apiClient.get<any>(`/payments/${id}`);
      const p = res.data;
      return {
        id: String(p.id),
        invoice_id: String(p.invoice_id),
        invoice_number: p.invoice_number || `INV-${p.invoice_id}`,
        customer_id: String(p.customer_id || 'usr'),
        customer_name: p.customer_name || 'Customer',
        amount: p.amount,
        payment_method: p.payment_method,
        payment_date: p.payment_date,
        reference_number: p.payment_number || p.reference_number,
        notes: p.notes,
        status: p.status || 'completed',
        created_at: p.created_at,
      };
    } catch {
      const payment = mockStore.getPayments().find((p) => p.id === id);
      if (!payment) throw new Error('Payment not found');
      return payment;
    }
  },
};
