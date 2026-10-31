import apiClient from './client';
import { Invoice, PaymentRecord, PaymentMethod } from '../types';
import { mockStore } from './mockStore';

export const invoicesApi = {
  getInvoices: async (params?: {
    status?: string;
    customer_id?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Invoice[]> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.status && params.status !== 'all') queryParams.append('status', params.status);
      if (params?.customer_id) queryParams.append('customer_id', params.customer_id);
      if (params?.search) queryParams.append('search', params.search);
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);

      const res = await apiClient.get<any[]>('/invoices/', { params: queryParams });
      return res.data.map((inv: any) => ({
        id: String(inv.id),
        invoice_number: inv.invoice_number,
        customer_id: String(inv.customer_id),
        customer_name: inv.customer?.full_name || inv.customer_name || 'Customer',
        customer_email: inv.customer?.email || inv.customer_email || 'client@example.com',
        customer_address: inv.customer?.company_name || inv.customer_address,
        subscription_id: inv.subscription_id ? String(inv.subscription_id) : undefined,
        subscription_number: inv.subscription?.subscription_number || inv.subscription_number,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        status: inv.status,
        subtotal: inv.subtotal,
        tax_amount: inv.tax_amount,
        discount_amount: inv.discount_amount || 0,
        total_amount: inv.total || inv.total_amount,
        amount_paid: inv.amount_paid || 0,
        balance_due: inv.amount_due ?? (inv.total - (inv.amount_paid || 0)),
        lines: (inv.lines || []).map((l: any, idx: number) => ({
          id: String(l.id || idx),
          description: l.description || l.product_name,
          product_name: l.product_name,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate || 10,
          tax_amount: l.tax_amount || 0,
          amount: l.subtotal || l.amount || l.quantity * l.unit_price,
        })),
        payments: (inv.payments || []).map((p: any) => ({
          id: String(p.id),
          invoice_id: String(inv.id),
          invoice_number: inv.invoice_number,
          customer_id: String(inv.customer_id),
          customer_name: inv.customer?.full_name,
          amount: p.amount,
          payment_method: p.payment_method,
          payment_date: p.payment_date,
          reference_number: p.payment_number || p.reference_number,
          notes: p.notes,
          status: p.status,
        })),
        notes: inv.notes,
        created_at: inv.created_at,
      }));
    } catch {
      let invoices = mockStore.getInvoices();
      if (params?.status && params.status !== 'all') {
        invoices = invoices.filter((inv) => inv.status === params.status);
      }
      if (params?.customer_id) {
        invoices = invoices.filter((inv) => inv.customer_id === params.customer_id);
      }
      if (params?.search) {
        const query = params.search.toLowerCase();
        invoices = invoices.filter(
          (inv) =>
            inv.invoice_number.toLowerCase().includes(query) ||
            inv.customer_name?.toLowerCase().includes(query) ||
            inv.subscription_number?.toLowerCase().includes(query)
        );
      }
      return invoices;
    }
  },

  getInvoiceById: async (id: string): Promise<Invoice> => {
    try {
      const res = await apiClient.get<any>(`/invoices/${id}`);
      const inv = res.data;
      return {
        id: String(inv.id),
        invoice_number: inv.invoice_number,
        customer_id: String(inv.customer_id),
        customer_name: inv.customer?.full_name || inv.customer_name || 'Customer',
        customer_email: inv.customer?.email || inv.customer_email || 'client@example.com',
        customer_address: inv.customer?.company_name || inv.customer_address,
        subscription_id: inv.subscription_id ? String(inv.subscription_id) : undefined,
        subscription_number: inv.subscription?.subscription_number || inv.subscription_number,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        status: inv.status,
        subtotal: inv.subtotal,
        tax_amount: inv.tax_amount,
        discount_amount: inv.discount_amount || 0,
        total_amount: inv.total || inv.total_amount,
        amount_paid: inv.amount_paid || 0,
        balance_due: inv.amount_due ?? (inv.total - (inv.amount_paid || 0)),
        lines: (inv.lines || []).map((l: any, idx: number) => ({
          id: String(l.id || idx),
          description: l.description || l.product_name,
          product_name: l.product_name,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate || 10,
          tax_amount: l.tax_amount || 0,
          amount: l.subtotal || l.amount || l.quantity * l.unit_price,
        })),
        payments: (inv.payments || []).map((p: any) => ({
          id: String(p.id),
          invoice_id: String(inv.id),
          invoice_number: inv.invoice_number,
          customer_id: String(inv.customer_id),
          customer_name: inv.customer?.full_name,
          amount: p.amount,
          payment_method: p.payment_method,
          payment_date: p.payment_date,
          reference_number: p.payment_number || p.reference_number,
          notes: p.notes,
          status: p.status,
        })),
        notes: inv.notes,
        created_at: inv.created_at,
      };
    } catch {
      const inv = mockStore.getInvoices().find((i) => i.id === id);
      if (!inv) throw new Error('Invoice not found');
      return inv;
    }
  },

  generateInvoices: async (): Promise<{ generated_count: number; message: string }> => {
    try {
      const res = await apiClient.post<any>('/invoices/bulk-generate');
      return {
        generated_count: res.data.generated_count,
        message: res.data.message || `Generated ${res.data.generated_count} invoices`,
      };
    } catch {
      const subs = mockStore.getSubscriptions().filter((s) => s.status === 'active');
      const invoices = mockStore.getInvoices();
      let count = 0;

      subs.forEach((sub) => {
        count++;
        const newInv: Invoice = {
          id: `inv_${Date.now()}_${count}`,
          invoice_number: `INV-2026-${String(invoices.length + count).padStart(4, '0')}`,
          customer_id: sub.customer_id,
          customer_name: sub.customer_name,
          customer_email: sub.customer_email,
          subscription_id: sub.id,
          subscription_number: sub.subscription_number,
          issue_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          status: 'confirmed',
          subtotal: sub.subtotal,
          tax_amount: sub.tax_amount,
          discount_amount: sub.discount_amount,
          total_amount: sub.total_amount,
          amount_paid: 0,
          balance_due: sub.total_amount,
          lines: sub.lines.map((l, idx) => ({
            id: `line_${idx}`,
            description: `${l.product_name || 'Service'}${l.variant_name ? ` - ${l.variant_name}` : ''}`,
            quantity: l.quantity,
            unit_price: l.unit_price,
            tax_rate: 10,
            tax_amount: Math.round(l.unit_price * l.quantity * 0.1 * 100) / 100,
            amount: l.unit_price * l.quantity,
          })),
          payments: [],
          created_at: new Date().toISOString(),
        };
        invoices.unshift(newInv);
      });

      mockStore.saveInvoices(invoices);
      return {
        generated_count: count,
        message: `Successfully generated ${count} invoice(s) for active subscriptions.`,
      };
    }
  },

  recordPayment: async (
    invoiceId: string,
    paymentData: {
      amount: number;
      payment_method: PaymentMethod;
      payment_date: string;
      reference_number?: string;
      notes?: string;
    }
  ): Promise<Invoice> => {
    try {
      await apiClient.post('/payments/', {
        invoice_id: Number(invoiceId) || invoiceId,
        amount: Number(paymentData.amount),
        payment_method: paymentData.payment_method,
        reference_number: paymentData.reference_number,
        notes: paymentData.notes,
      });
      return await invoicesApi.getInvoiceById(invoiceId);
    } catch {
      const invoices = mockStore.getInvoices();
      const payments = mockStore.getPayments();
      const index = invoices.findIndex((i) => i.id === invoiceId);
      if (index === -1) throw new Error('Invoice not found');

      const inv = invoices[index];
      const newPayment: PaymentRecord = {
        id: `pay_${Date.now()}`,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        customer_id: inv.customer_id,
        customer_name: inv.customer_name,
        amount: Number(paymentData.amount),
        payment_method: paymentData.payment_method,
        payment_date: paymentData.payment_date,
        reference_number: paymentData.reference_number || `TXN-${Math.floor(1000000 + Math.random() * 9000000)}`,
        notes: paymentData.notes,
        status: 'completed',
        created_at: new Date().toISOString(),
      };

      const newPaid = Number(inv.amount_paid || 0) + Number(paymentData.amount);
      const newBalance = Math.max(0, inv.total_amount - newPaid);

      inv.amount_paid = newPaid;
      inv.balance_due = newBalance;
      if (newBalance <= 0) {
        inv.status = 'paid';
      }
      if (!inv.payments) inv.payments = [];
      inv.payments.push(newPayment);

      invoices[index] = inv;
      mockStore.saveInvoices(invoices);

      payments.unshift(newPayment);
      mockStore.savePayments(payments);

      return inv;
    }
  },
};
