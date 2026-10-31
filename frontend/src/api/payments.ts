import apiClient, { listAll, matches } from './client';
import { PaymentRecord } from '../types';
import { mapPayment } from './mappers';
export const paymentsApi = {
  getPayments: async (p?: {
    method?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<PaymentRecord[]> =>
    (await listAll('/payments/', { payment_method: p?.method === 'all' ? undefined : p?.method }))
      .map(mapPayment)
      .filter(
        (r) =>
          matches(`${r.customer_name} ${r.invoice_number} ${r.reference_number}`, p?.search) &&
          (!p?.startDate || r.payment_date >= p.startDate) &&
          (!p?.endDate || r.payment_date.slice(0, 10) <= p.endDate),
      ),
  getPaymentById: async (id: string) => mapPayment((await apiClient.get(`/payments/${id}`)).data),
};
