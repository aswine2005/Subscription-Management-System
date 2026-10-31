import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Repeat,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Plus,
  Zap,
  ArrowUpRight,
  Clock,
  Sparkles,
} from 'lucide-react';
import { dashboardApi } from '../../api/dashboard';
import { StatCard } from '../../components/ui/StatCard';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { RevenueChart } from '../../components/charts/RevenueChart';
import { SubscriptionChart } from '../../components/charts/SubscriptionChart';
import { PlanDistribution } from '../../components/charts/PlanDistribution';
import { formatCurrency, formatNumber, formatRelativeTime } from '../../utils/formatters';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardApi.getSummary,
  });

  if (isLoading) {
    return (
      <div className="py-24">
        <LoadingSpinner size="lg" text="Analyzing real-time metrics & financial streams..." />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-8 text-center glass-card rounded-2xl">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-lg font-bold">Failed to load dashboard metrics</h3>
        <p className="text-sm text-slate-500 mt-1">Please verify backend connectivity.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Revenue & Subscription Intelligence
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Data
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time subscriber lifecycle, recurring revenue, and billing operations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            leftIcon={<Zap className="w-4 h-4 text-indigo-500" />}
            onClick={() => navigate('/invoices')}
          >
            Billing Ops
          </Button>
          <Button
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/subscriptions')}
          >
            New Subscription
          </Button>
        </div>
      </div>

      {/* Top Row: 4 StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          label="Active Subscriptions"
          value={formatNumber(summary.active_subscriptions)}
          change={summary.active_subscriptions_change}
          changeLabel="vs last month"
          icon={<Repeat className="w-6 h-6" />}
          iconColor="indigo"
        />
        <StatCard
          label="Monthly Recurring Revenue"
          value={formatCurrency(summary.mrr)}
          change={summary.mrr_change}
          changeLabel="vs last month"
          icon={<DollarSign className="w-6 h-6" />}
          iconColor="purple"
        />
        <StatCard
          label="Revenue This Month"
          value={formatCurrency(summary.revenue_this_month)}
          change={summary.revenue_this_month_change}
          changeLabel="vs last month"
          icon={<TrendingUp className="w-6 h-6" />}
          iconColor="emerald"
        />
        <StatCard
          label="Overdue Invoices"
          value={formatNumber(summary.overdue_invoices)}
          change={summary.overdue_invoices_change}
          changeLabel="vs last month"
          icon={<AlertCircle className="w-6 h-6" />}
          iconColor="rose"
        />
      </div>

      {/* Charts Row: Revenue Growth + Subscription Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Area Chart */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader
              title="Revenue Trajectory (Last 12 Months)"
              subtitle="Audited recurring payments vs forecast milestones"
              action={
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-lg">
                  MRR Trend
                </span>
              }
            />
            <div className="pt-2">
              <RevenueChart data={summary.revenue_chart} height={310} />
            </div>
          </Card>
        </div>

        {/* Subscription Status Donut Chart */}
        <div>
          <Card className="h-full">
            <CardHeader
              title="Subscription States"
              subtitle="Active distribution across customer portfolio"
            />
            <div className="pt-1">
              <SubscriptionChart data={summary.subscription_status} height={230} />
            </div>
          </Card>
        </div>
      </div>

      {/* Plan Distribution Bar Chart & Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Distribution */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader
              title="Plan Distribution"
              subtitle="Active members enrolled per tier"
            />
            <div className="pt-2">
              <PlanDistribution data={summary.plan_distribution} height={280} />
            </div>
          </Card>
        </div>

        {/* Top 5 Customers */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader
              title="Top Enterprise Customers"
              subtitle="Accounts generating highest lifetime recurring value"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
                  onClick={() => navigate('/subscriptions')}
                >
                  View All
                </Button>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3">Client</th>
                    <th className="pb-3">Subscriptions</th>
                    <th className="pb-3 text-right">Total Spent</th>
                    <th className="pb-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {summary.top_customers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {c.name}
                        </div>
                        <div className="text-xs text-slate-400">{c.email}</div>
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">
                        {c.subscriptions_count} active
                      </td>
                      <td className="py-3 text-right font-bold text-slate-900 dark:text-white">
                        {formatCurrency(c.total_spent)}
                      </td>
                      <td className="py-3 text-right">
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <Card>
        <CardHeader
          title="Audit Log & Activity Feed"
          subtitle="Real-time timeline of billing events, state shifts, and invoice receipts"
        />
        <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
          {summary.recent_activity.map((act) => (
            <div key={act.id} className="py-3.5 flex items-start gap-3.5 first:pt-1 last:pb-1">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {act.title}
                  </h5>
                  <span className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                    <Clock className="w-3 h-3" />
                    <span>{formatRelativeTime(act.timestamp)}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {act.description}
                </p>
                {act.user && (
                  <span className="inline-block mt-1 text-[10px] text-indigo-500 font-medium">
                    Triggered by: {act.user}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
