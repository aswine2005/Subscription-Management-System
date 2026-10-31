import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Repeat, CheckCircle2 } from 'lucide-react';
import { plansApi } from '../../api/plans';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { showToast } from '../../components/ui/Toast';
import { subscriptionsApi } from '../../api/subscriptions';
import { useAuth } from '../../hooks/useAuth';

import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SearchBar } from '../../components/ui/SearchBar';
import { formatCurrency, formatDate, formatBillingCycle } from '../../utils/formatters';

export const CustomerSubscriptions: React.FC = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [planId, setPlanId] = useState('');
  const qc = useQueryClient();
  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: () => plansApi.getPlans(),
  });
  const action = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) =>
      type === 'renew'
        ? subscriptionsApi.renewSubscription(id)
        : type === 'confirm'
          ? subscriptionsApi.advanceStatus(id)
          : type === 'close'
            ? subscriptionsApi.closeSubscription(id)
            : subscriptionsApi.pauseSubscription(id),
    onSuccess: () => {
      qc.invalidateQueries();
      showToast.success('Subscription updated.');
    },
  });
  const request = useMutation({
    mutationFn: async () => {
      const s = await subscriptionsApi.createSubscription({
        plan_id: planId,
        customer_id: user!.id,
      });
      return subscriptionsApi.advanceStatus(s.id);
    },
    onSuccess: () => {
      qc.invalidateQueries();
      setPlanId('');
      showToast.success('Quotation requested. Your billing team will review it.');
    },
  });

  const customerId = user?.id || 'usr_3';

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['customer-subscriptions', customerId, search],
    queryFn: () => subscriptionsApi.getSubscriptions({ customer_id: customerId, search }),
  });

  if (isLoading) {
    return (
      <div className="py-24">
        <LoadingSpinner size="lg" text="Retrieving active subscription contracts..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 ">
            My Subscriptions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review active contracts, billing renewals, and included service modules.
          </p>
        </div>

        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search my subscriptions..."
          className="w-full sm:w-80"
        />
      </div>

      <div className="panel p-5 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[160px]">
          <Select
            label="Start something new"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            options={[
              { value: '', label: 'Choose a subscription plan' },
              ...plans
                .filter((p) => p.status === 'active')
                .map((p) => ({
                  value: p.id,
                  label: `${p.name} · ${formatCurrency(p.price)} / ${p.billing_cycle}`,
                })),
            ]}
          />
        </div>
        <Button disabled={!planId} isLoading={request.isPending} onClick={() => request.mutate()}>
          Request quotation
        </Button>
      </div>
      {subscriptions.length === 0 ? (
        <Card className="py-16 text-center">
          <Repeat className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800 ">No Subscriptions Found</h3>
          <p className="text-xs text-slate-400 mt-1">
            You do not currently have any subscriptions enrolled.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {subscriptions.map((sub) => (
            <Card key={sub.id} hover className="flex flex-col justify-between">
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-semibold shadow-md  shrink-0">
                      <Repeat className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-base text-slate-900 ">{sub.plan_name}</h4>
                      <span className="font-mono text-xs text-slate-400">
                        {sub.subscription_number}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={sub.status} size="sm" />
                </div>

                {/* Recurrence & Terms */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50/70 text-xs mb-4">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Billing Cadence</span>
                    <strong className="text-indigo-600 capitalize">
                      {formatBillingCycle(sub.billing_cycle)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Next Renewal</span>
                    <strong className="text-slate-800 ">{formatDate(sub.expiry_date)}</strong>
                  </div>
                </div>

                {/* Line Items List */}
                <div className="space-y-2 mb-4">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Provisioned Services:
                  </span>
                  {sub.lines.map((line, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-none"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="font-medium text-slate-800 ">
                          {line.product_name}
                          {line.variant_name ? ` (${line.variant_name})` : ''}
                        </span>
                        <span className="text-slate-400">× {line.quantity}</span>
                      </div>
                      <span className="font-semibold text-slate-900 ">
                        {formatCurrency(line.quantity * line.unit_price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {sub.status === 'quotation' && (
                  <Button
                    size="sm"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ id: sub.id, type: 'confirm' })}
                  >
                    Accept quotation
                  </Button>
                )}
                {sub.allow_pause && ['active', 'paused'].includes(sub.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ id: sub.id, type: 'pause' })}
                  >
                    {sub.status === 'paused' ? 'Resume' : 'Pause'}
                  </Button>
                )}
                {sub.allow_renewal &&
                  ['active', 'paused', 'confirmed', 'closed'].includes(sub.status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ id: sub.id, type: 'renew' })}
                    >
                      Renew
                    </Button>
                  )}
                {['active', 'paused'].includes(sub.status) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ id: sub.id, type: 'close' })}
                  >
                    Close subscription
                  </Button>
                )}
              </div>
              {/* Total Card Footer */}
              <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-sm">
                <span className="text-xs text-slate-500">Recurring Total Amount:</span>
                <span className="font-semibold text-lg text-indigo-600 ">
                  {formatCurrency(sub.total_amount)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
