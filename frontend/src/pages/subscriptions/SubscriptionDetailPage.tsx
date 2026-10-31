import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Play,
  Pause,
  XCircle,
  FileText,
  User,
  Layers,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import clsx from 'clsx';
import { subscriptionsApi } from '../../api/subscriptions';
import { invoicesApi } from '../../api/invoices';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatCurrency, formatDate, formatBillingCycle } from '../../utils/formatters';
import { showToast } from '../../components/ui/Toast';
import { SubscriptionStatus } from '../../types';

export const SubscriptionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', id],
    queryFn: () => subscriptionsApi.getSubscriptionById(id!),
    enabled: !!id,
  });

  const { data: allInvoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.getInvoices(),
  });

  const relatedInvoices = allInvoices.filter(
    (inv) => inv.subscription_id === id || inv.subscription_number === subscription?.subscription_number
  );

  const advanceMutation = useMutation({
    mutationFn: () => subscriptionsApi.advanceStatus(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['subscription', id], updated);
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      showToast.success(`Subscription advanced to ${updated.status.toUpperCase()}`);
    },
    onError: (err: any) => {
      showToast.error(err?.message || 'Failed to advance status');
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => subscriptionsApi.pauseSubscription(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['subscription', id], updated);
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      showToast.success(
        updated.status === 'paused' ? 'Subscription paused' : 'Subscription resumed'
      );
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => subscriptionsApi.closeSubscription(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['subscription', id], updated);
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      showToast.success('Subscription closed');
    },
  });

  if (isLoading) {
    return (
      <div className="py-24">
        <LoadingSpinner size="lg" text="Loading subscription details..." />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="text-center py-16">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold">Subscription Not Found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/subscriptions')}>
          Return to Subscriptions
        </Button>
      </div>
    );
  }

  // Stepper timeline
  const pipelineSteps: { key: SubscriptionStatus; label: string }[] = [
    { key: 'draft', label: 'Draft Created' },
    { key: 'quotation', label: 'Quotation Sent' },
    { key: 'confirmed', label: 'Confirmed by Client' },
    { key: 'active', label: 'Active & Recurring' },
  ];

  const currentStepIndex = pipelineSteps.findIndex((s) => s.key === subscription.status);

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/subscriptions')}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {subscription.subscription_number}
              </h1>
              <StatusBadge status={subscription.status} size="md" />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Created on {formatDate(subscription.created_at)} • Payment terms: {subscription.payment_terms || 'Net 30'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {subscription.status !== 'active' && subscription.status !== 'closed' && (
            <Button
              variant="primary"
              leftIcon={<Play className="w-4 h-4" />}
              onClick={() => advanceMutation.mutate()}
              isLoading={advanceMutation.isPending}
            >
              Advance to Next State
            </Button>
          )}

          {subscription.status === 'active' && (
            <Button
              variant="secondary"
              leftIcon={<Pause className="w-4 h-4 text-amber-500" />}
              onClick={() => pauseMutation.mutate()}
              isLoading={pauseMutation.isPending}
            >
              Pause Contract
            </Button>
          )}

          {subscription.status === 'paused' && (
            <Button
              variant="success"
              leftIcon={<Play className="w-4 h-4" />}
              onClick={() => pauseMutation.mutate()}
              isLoading={pauseMutation.isPending}
            >
              Resume Contract
            </Button>
          )}

          {subscription.status !== 'closed' && (
            <Button
              variant="ghost"
              className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              leftIcon={<XCircle className="w-4 h-4" />}
              onClick={() => {
                if (window.confirm('Are you sure you want to close this subscription permanently?')) {
                  closeMutation.mutate();
                }
              }}
              isLoading={closeMutation.isPending}
            >
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Stepper Timeline Card */}
      <Card className="p-6">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
          Contract Lifecycle Progression
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative">
          {pipelineSteps.map((step, idx) => {
            const isCompleted =
              currentStepIndex >= idx ||
              subscription.status === 'closed' ||
              (subscription.status === 'paused' && idx <= 3);
            const isCurrent = currentStepIndex === idx;

            return (
              <div key={step.key} className="flex flex-col items-center sm:items-start text-center sm:text-left">
                <div className="flex items-center gap-2 w-full mb-2">
                  <div
                    className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all',
                      isCompleted
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700'
                    )}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <div
                    className={clsx(
                      'hidden sm:block flex-1 h-1 rounded',
                      idx === pipelineSteps.length - 1 ? 'hidden' : '',
                      isCompleted && currentStepIndex > idx ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'
                    )}
                  />
                </div>
                <span
                  className={clsx(
                    'text-xs font-bold',
                    isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'
                  )}
                >
                  {step.label}
                </span>
                <span className="text-[11px] text-slate-400 capitalize mt-0.5">{step.key}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 2-Column: Customer Info & Plan Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Card */}
        <Card>
          <CardHeader
            title="Customer Information"
            subtitle="Account entity linked to this subscription"
          />
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 font-bold text-lg">
              {subscription.customer_name?.charAt(0) || <User className="w-6 h-6" />}
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                {subscription.customer_name}
              </h4>
              <p className="text-xs text-slate-400">{subscription.customer_email}</p>
              <div className="pt-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Customer ID:</span> {subscription.customer_id}
              </div>
            </div>
          </div>
        </Card>

        {/* Plan Info Card */}
        <Card>
          <CardHeader
            title="Plan & Billing Terms"
            subtitle="Subscription recurrence specifications"
          />
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Assigned Plan</span>
              <strong className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-500" />
                {subscription.plan_name}
              </strong>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Billing Recurrence</span>
              <strong className="text-sm font-bold text-indigo-600 dark:text-indigo-400 capitalize">
                {formatBillingCycle(subscription.billing_cycle)}
              </strong>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Start Date</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {formatDate(subscription.start_date)}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Expiry Date</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {formatDate(subscription.expiry_date)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Subscription Lines Table */}
      <Card padding="none">
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <h4 className="text-base font-semibold text-slate-900 dark:text-white">
            Line Items & Provisioning
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">Products and units included in this recurrence period</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3">Product / Service</th>
                <th className="px-6 py-3">Variant / Tier</th>
                <th className="px-6 py-3 text-center">Quantity</th>
                <th className="px-6 py-3 text-right">Unit Price</th>
                <th className="px-6 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {subscription.lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20">
                  <td className="px-6 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                    {line.product_name || 'Standard Service'}
                  </td>
                  <td className="px-6 py-3.5 text-slate-500">
                    {line.variant_name ? (
                      <span className="px-2 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {line.variant_name}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-center font-medium">{line.quantity}</td>
                  <td className="px-6 py-3.5 text-right">{formatCurrency(line.unit_price)}</td>
                  <td className="px-6 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                    {formatCurrency(line.quantity * line.unit_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Totals */}
        <div className="p-6 bg-slate-50/40 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {formatCurrency(subscription.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Tax (VAT 10%):</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {formatCurrency(subscription.tax_amount)}
              </span>
            </div>
            {subscription.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                <span>Discount applied:</span>
                <span>-{formatCurrency(subscription.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold pt-2 border-t border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400">
              <span>Recurring Total:</span>
              <span>{formatCurrency(subscription.total_amount)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Related Invoices Section */}
      <Card>
        <CardHeader
          title="Related Invoices & Statements"
          subtitle="Invoices generated under this subscription agreement"
          action={
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FileText className="w-3.5 h-3.5" />}
              onClick={() => navigate('/invoices')}
            >
              Invoices Console
            </Button>
          }
        />

        {relatedInvoices.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No invoices generated yet for this subscription.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {relatedInvoices.map((inv) => (
              <div
                key={inv.id}
                className="py-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-colors cursor-pointer"
                onClick={() => navigate(`/invoices/${inv.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {inv.invoice_number}
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      Due {formatDate(inv.due_date)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {formatCurrency(inv.total_amount)}
                  </span>
                  <StatusBadge status={inv.status} size="sm" />
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
