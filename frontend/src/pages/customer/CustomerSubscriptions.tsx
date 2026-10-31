import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Repeat, Calendar, Layers, CheckCircle2 } from 'lucide-react';
import { subscriptionsApi } from '../../api/subscriptions';
import { useAuth } from '../../hooks/useAuth';
import { Subscription } from '../../types';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SearchBar } from '../../components/ui/SearchBar';
import { formatCurrency, formatDate, formatBillingCycle } from '../../utils/formatters';

export const CustomerSubscriptions: React.FC = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
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
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            My Subscriptions
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
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

      {subscriptions.length === 0 ? (
        <Card className="py-16 text-center">
          <Repeat className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            No Subscriptions Found
          </h3>
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
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20 shrink-0">
                      <Repeat className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                        {sub.plan_name}
                      </h4>
                      <span className="font-mono text-xs text-slate-400">
                        {sub.subscription_number}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={sub.status} size="sm" />
                </div>

                {/* Recurrence & Terms */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 text-xs mb-4">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Billing Cadence</span>
                    <strong className="text-indigo-600 dark:text-indigo-400 capitalize">
                      {formatBillingCycle(sub.billing_cycle)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Next Renewal</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {formatDate(sub.expiry_date)}
                    </strong>
                  </div>
                </div>

                {/* Line Items List */}
                <div className="space-y-2 mb-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Provisioned Services:
                  </span>
                  {sub.lines.map((line, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-none"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {line.product_name}
                          {line.variant_name ? ` (${line.variant_name})` : ''}
                        </span>
                        <span className="text-slate-400">× {line.quantity}</span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatCurrency(line.quantity * line.unit_price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Card Footer */}
              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-sm">
                <span className="text-xs text-slate-500">Recurring Total Amount:</span>
                <span className="font-black text-lg text-indigo-600 dark:text-indigo-400">
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
