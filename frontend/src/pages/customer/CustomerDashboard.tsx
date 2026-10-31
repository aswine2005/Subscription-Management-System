import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Repeat, IndianRupee, Calendar, ArrowRight, FileText } from 'lucide-react';
import { dashboardApi } from '../../api/dashboard';
import { useAuth } from '../../hooks/useAuth';
import { StatCard } from '../../components/ui/StatCard';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const customerId = user?.id || 'usr_3';

  const { data, isLoading } = useQuery({
    queryKey: ['customer-dashboard', customerId],
    queryFn: () => dashboardApi.getCustomerDashboard(customerId),
  });

  if (isLoading) {
    return (
      <div className="py-24">
        <LoadingSpinner size="lg" text="Loading your subscription portfolio..." />
      </div>
    );
  }

  const {
    active_subscriptions_count = 0,
    total_spent = 0,
    next_billing_date = '',
    recent_subscriptions = [],
    recent_invoices = [],
  } = data || {};

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="glass-card p-6 sm:p-8 rounded-lg relative overflow-hidden bg-[#eef2e5] border border-indigo-500/20">
        <div className="relative z-10 max-w-2xl">
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-500/20 text-[#74875c] border border-indigo-500/30 uppercase tracking-wider">
            Customer Dashboard
          </span>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mt-3">
            Welcome back, {user?.name || 'Customer'}!
          </h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Manage your company subscriptions, review ongoing SaaS agreements, download tax
            invoices, and track upcoming billing cycles seamlessly.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard
          label="Active Subscriptions"
          value={active_subscriptions_count}
          icon={<Repeat className="w-6 h-6" />}
          iconColor="indigo"
        />
        <StatCard
          label="Total Spent (YTD)"
          value={formatCurrency(total_spent)}
          icon={<IndianRupee className="w-6 h-6" />}
          iconColor="emerald"
        />
        <StatCard
          label="Next Billing Cycle"
          value={formatDate(next_billing_date)}
          icon={<Calendar className="w-6 h-6" />}
          iconColor="purple"
        />
      </div>

      {/* 2-Column: Recent Subscriptions & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Subscriptions Card */}
        <Card>
          <CardHeader
            title="My Subscriptions"
            subtitle="Current recurring plans and contracts"
            action={
              <Button
                variant="ghost"
                size="sm"
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                onClick={() => navigate('/portal/subscriptions')}
              >
                View All
              </Button>
            }
          />

          {recent_subscriptions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No subscriptions found under your account.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 ">
              {recent_subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="py-3.5 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-lg transition-colors cursor-pointer"
                  onClick={() => navigate('/portal/subscriptions')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-semibold shrink-0">
                      <Repeat className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-sm text-slate-900 ">{sub.plan_name}</h5>
                      <span className="text-xs text-slate-400 font-mono">
                        {sub.subscription_number} • Renewal: {formatDate(sub.expiry_date)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm text-slate-900 ">
                      {formatCurrency(sub.total_amount)}
                    </span>
                    <StatusBadge status={sub.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Invoices Card */}
        <Card>
          <CardHeader
            title="Recent Invoices"
            subtitle="Payment records and due invoices"
            action={
              <Button
                variant="ghost"
                size="sm"
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                onClick={() => navigate('/portal/invoices')}
              >
                View All
              </Button>
            }
          />

          {recent_invoices.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No invoices generated yet for your account.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 ">
              {recent_invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="py-3.5 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-lg transition-colors cursor-pointer"
                  onClick={() => navigate('/portal/invoices')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-semibold shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-sm text-slate-900 font-mono">
                        {inv.invoice_number}
                      </h5>
                      <span className="text-xs text-slate-400">
                        Due: {formatDate(inv.due_date)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm text-slate-900 ">
                      {formatCurrency(inv.total_amount)}
                    </span>
                    <StatusBadge status={inv.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
