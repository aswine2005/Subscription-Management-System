import apiClient, { listAll, dateTime, matches } from './client';
import { Invoice, PaymentMethod } from '../types';
import { mapInvoice, mapPayment } from './mappers';
export const invoicesApi = {
  getInvoices: async (p?: {
    status?: string;
    customer_id?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Invoice[]> =>
    (await listAll('/invoices/', { customer_id: p?.customer_id }))
      .map(mapInvoice)
      .filter(
        (i) =>
          (!p?.status || p.status === 'all' || i.status === p.status) &&
          matches(`${i.invoice_number} ${i.customer_name} ${i.customer_email}`, p?.search) &&
          (!p?.startDate || i.issue_date >= p.startDate) &&
          (!p?.endDate || i.issue_date.slice(0, 10) <= p.endDate),
      ),
  getInvoiceById: async (id: string) => {
    const [invoice, payments] = await Promise.all([
      apiClient.get(`/invoices/${id}`),
      listAll('/payments/', { invoice_id: id }),
    ]);
    return { ...mapInvoice(invoice.data), payments: payments.map(mapPayment) };
  },
  generateInvoices: async (): Promise<{ generated_count: number; message: string }> =>
    (await apiClient.post('/invoices/bulk-generate')).data,
  recordPayment: async (
    invoiceId: string,
    p: {
      amount: number;
      payment_method: PaymentMethod;
      payment_date: string;
      reference_number?: string;
      notes?: string;
    },
  ): Promise<Invoice> => {
    await apiClient.post('/payments/', {
      invoice_id: Number(invoiceId),
      amount: p.amount,
      payment_method: p.payment_method,
      payment_date: dateTime(p.payment_date),
      reference_note: [p.reference_number, p.notes].filter(Boolean).join(' · '),
    });
    return invoicesApi.getInvoiceById(invoiceId);
  },
};
