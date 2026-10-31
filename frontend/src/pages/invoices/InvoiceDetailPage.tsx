import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  DollarSign,
  Printer,
  Calendar,
  Building,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { invoicesApi } from '../../api/invoices';
import { paymentRecordSchema, PaymentRecordFormData } from '../../utils/validators';
import { PaymentMethod } from '../../types';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { showToast } from '../../components/ui/Toast';

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.getInvoiceById(id!),
    enabled: !!id,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentRecordFormData>({
    resolver: zodResolver(paymentRecordSchema),
    defaultValues: {
      amount: invoice?.balance_due || 0,
      payment_method: 'credit_card',
      payment_date: new Date().toISOString().split('T')[0],
      reference_number: '',
      notes: '',
    },
  });

  React.useEffect(() => {
    if (invoice) {
      reset({
        amount: invoice.balance_due > 0 ? invoice.balance_due : invoice.total_amount,
        payment_method: 'credit_card',
        payment_date: new Date().toISOString().split('T')[0],
        reference_number: `TXN-${Math.floor(1000000 + Math.random() * 9000000)}`,
        notes: '',
      });
    }
  }, [invoice, reset, isPaymentModalOpen]);

  const paymentMutation = useMutation({
    mutationFn: (data: PaymentRecordFormData) =>
      invoicesApi.recordPayment(id!, {
        ...data,
        payment_method: data.payment_method as PaymentMethod,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['invoice', id], updated);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      showToast.success('Payment recorded successfully!');
      setIsPaymentModalOpen(false);
    },
    onError: (err: any) => {
      showToast.error(err?.message || 'Failed to record payment');
    },
  });

  const handlePaymentSubmit = async (data: PaymentRecordFormData) => {
    await paymentMutation.mutateAsync(data);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="py-24">
        <LoadingSpinner size="lg" text="Loading invoice document..." />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold">Invoice Not Found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/invoices')}>
          Return to Invoices
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {invoice.invoice_number}
              </h1>
              <StatusBadge status={invoice.status} size="md" />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Issue Date: {formatDate(invoice.issue_date)} • Due Date: {formatDate(invoice.due_date)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            Print / PDF
          </Button>

          {invoice.balance_due > 0 && invoice.status !== 'paid' && (
            <Button
              variant="primary"
              leftIcon={<DollarSign className="w-4 h-4" />}
              onClick={() => setIsPaymentModalOpen(true)}
            >
              Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* Invoice Main Sheet Card */}
      <Card className="p-8 sm:p-10 shadow-2xl">
        {/* Document Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-8 border-b border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Bright<span className="text-indigo-600 dark:text-indigo-400">Loop</span>
            </span>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              BrightLoop Global Subscription Technologies Inc.<br />
              100 Technology Plaza, San Francisco, CA 94105<br />
              billing@brightloop.io
            </p>
          </div>

          <div className="text-right sm:text-right">
            <h3 className="text-xl font-black uppercase tracking-wider text-slate-400">
              TAX INVOICE
            </h3>
            <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
              {invoice.invoice_number}
            </p>
            {invoice.subscription_number && (
              <p className="text-xs text-indigo-500 mt-0.5 font-mono">
                Sub: {invoice.subscription_number}
              </p>
            )}
          </div>
        </div>

        {/* Bill To & Date Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-8 border-b border-slate-200 dark:border-slate-800 text-sm">
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Billed To:
            </h5>
            <div className="space-y-1">
              <strong className="text-base text-slate-900 dark:text-white block">
                {invoice.customer_name}
              </strong>
              <p className="text-xs text-slate-500 dark:text-slate-400">{invoice.customer_email}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {invoice.customer_address || '100 Enterprise Way, Suite 400'}
              </p>
            </div>
          </div>

          <div className="sm:text-right space-y-2 text-xs">
            <div>
              <span className="text-slate-400">Invoice Date:</span>{' '}
              <strong className="text-slate-800 dark:text-slate-200">{formatDate(invoice.issue_date)}</strong>
            </div>
            <div>
              <span className="text-slate-400">Payment Due:</span>{' '}
              <strong className="text-slate-800 dark:text-slate-200">{formatDate(invoice.due_date)}</strong>
            </div>
            <div>
              <span className="text-slate-400">Payment Status:</span>{' '}
              <strong className="capitalize text-slate-800 dark:text-slate-200">{invoice.status}</strong>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="py-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3">Description</th>
                <th className="py-3 text-center">Qty</th>
                <th className="py-3 text-right">Unit Price</th>
                <th className="py-3 text-right">Tax (10%)</th>
                <th className="py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {invoice.lines.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20">
                  <td className="py-3.5 font-medium text-slate-900 dark:text-slate-100">
                    {item.description || item.product_name}
                  </td>
                  <td className="py-3.5 text-center">{item.quantity}</td>
                  <td className="py-3.5 text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="py-3.5 text-right text-slate-400">{formatCurrency(item.tax_amount)}</td>
                  <td className="py-3.5 text-right font-bold text-slate-900 dark:text-white">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <div className="w-full max-w-sm space-y-2 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal:</span>
              <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(invoice.subtotal)}</strong>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Tax (VAT 10%):</span>
              <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(invoice.tax_amount)}</strong>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                <span>Discount applied:</span>
                <strong>-{formatCurrency(invoice.discount_amount)}</strong>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
              <span>Total Invoice Amount:</span>
              <span>{formatCurrency(invoice.total_amount)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Amount Paid:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(invoice.amount_paid)}
              </span>
            </div>
            <div className="flex justify-between text-base font-black pt-2 border-t-2 border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <span>Balance Due:</span>
              <span>{formatCurrency(invoice.balance_due)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Payment History Card */}
      <Card>
        <CardHeader
          title="Payment History & Transactions"
          subtitle="Audit ledger of remittances applied to this invoice"
        />

        {(!invoice.payments || invoice.payments.length === 0) ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No payments have been recorded for this invoice yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {invoice.payments.map((p) => (
              <div key={p.id} className="py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {formatCurrency(p.amount)} via {p.payment_method.replace('_', ' ').toUpperCase()}
                    </div>
                    <div className="text-xs text-slate-400">
                      Ref: {p.reference_number || 'N/A'} • {formatDateTime(p.payment_date)}
                    </div>
                  </div>
                </div>

                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  Completed
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Record Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Invoice Payment"
        description={`Record incoming remittance for invoice ${invoice.invoice_number}`}
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setIsPaymentModalOpen(false)}
              disabled={paymentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit(handlePaymentSubmit)}
              isLoading={paymentMutation.isPending}
            >
              Confirm Payment
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(handlePaymentSubmit)} className="space-y-4">
          <Input
            label="Payment Amount ($)"
            type="number"
            step="0.01"
            error={errors.amount?.message}
            {...register('amount')}
          />

          <Select
            label="Payment Method"
            options={[
              { value: 'credit_card', label: 'Credit Card / Stripe' },
              { value: 'bank_transfer', label: 'Bank Wire Transfer' },
              { value: 'paypal', label: 'PayPal' },
              { value: 'cash', label: 'Cash / Direct Remittance' },
            ]}
            error={errors.payment_method?.message}
            {...register('payment_method')}
          />

          <Input
            label="Payment Date"
            type="date"
            error={errors.payment_date?.message}
            {...register('payment_date')}
          />

          <Input
            label="Transaction Reference / Note"
            placeholder="e.g. TXN-8839210 or Wire #4928"
            error={errors.reference_number?.message}
            {...register('reference_number')}
          />
        </form>
      </Modal>
    </div>
  );
};
