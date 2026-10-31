import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Download,
  Target,
  Repeat2,
  Clock3,
  ShieldCheck,
  Flag,
  ChevronRight,
  Activity,
  Wallet,
  CheckCircle2,
} from 'lucide-react';
import { dashboardApi } from '../../api/dashboard';
import { recoveryApi } from '../../api/recovery';
import apiClient from '../../api/client';
import {
  formatCurrency,
  formatCompactCurrency,
  formatDate,
  formatRelativeTime,
} from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export function DashboardPage() {
  const navigate = useNavigate();
  const [months, setMonths] = useState(6);
  const {
    data: d,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardApi.getSummary,
    refetchInterval: 30000,
  });
  const { data: recovery } = useQuery({
    queryKey: ['recovery', 1],
    queryFn: ({ signal }) => recoveryApi.overview(1, signal),
    refetchInterval: 30000,
  });
  const { data: billing } = useQuery({
    queryKey: ['billing-preview'],
    queryFn: async () => (await apiClient.get('/invoices/billing-preview')).data,
    refetchInterval: 30000,
  });
  if (isLoading)
    return (
      <div className="py-32">
        <LoadingSpinner text="Getting your business in view…" />
      </div>
    );
  if (isError || !d)
    return (
      <div className="panel p-8">
        <h1 className="page-heading">Your workspace is temporarily unavailable.</h1>
        <p className="subtle my-4">Check the local API connection and try again.</p>
        <Button onClick={() => refetch()}>Try again</Button>
      </div>
    );
  const chart = d.revenue_chart
    .slice(-months)
    .map((m) => ({ ...m, label: formatDate(m.month + '-01', 'MMM') }));
  const periodRevenue = chart.reduce((a, m) => a + m.revenue, 0);
  const lastMonth = d.revenue_chart[d.revenue_chart.length - 2]?.revenue || 0;
  const change = lastMonth ? ((d.revenue_this_month - lastMonth) / lastMonth) * 100 : null;
  const overdue = recovery?.summary.overdue_balance ?? d.overdue_amount;
  const overdueShare =
    recovery?.summary.overdue_share ??
    (d.outstanding_revenue ? (d.overdue_amount / d.outstanding_revenue) * 100 : 0);
  const exportReport = () => {
    const rows = [
      ['Metric', 'Value', 'Currency'],
      ['Monthly recurring revenue', d.mrr, 'INR'],
      ['Annual recurring revenue', d.arr, 'INR'],
      ['Active subscriptions', d.active_subscriptions, ''],
      ['Collected this month', d.revenue_this_month, 'INR'],
      ['Outstanding', d.outstanding_revenue, 'INR'],
      ['Overdue invoices', d.overdue_invoices, ''],
      ['Overdue amount', d.overdue_amount, 'INR'],
      [],
      ['Month', 'Collected revenue', 'Currency'],
      ...chart.map((m) => [m.month, m.revenue, 'INR']),
    ];
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(
      new Blob(['\uFEFF' + rows.map((row) => row.join(',')).join('\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    anchor.download = `brightloop-revenue-INR-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };
  return (
    <div className="command-overview">
      <div className="command-heading">
        <div>
          <div className="section-kicker">YOUR REVENUE WORKSPACE</div>
          <h1>
            Overview<span>.</span>
          </h1>
          <p>A clear picture. A better next move.</p>
        </div>
        <div className="command-heading-actions">
          <Button
            variant="secondary"
            aria-label="Export report"
            leftIcon={<Download size={14} />}
            onClick={exportReport}
          >
            <span className="export-label">Export report</span>
          </Button>
          <Button leftIcon={<Plus size={14} />} onClick={() => navigate('/subscriptions?new=1')}>
            New subscription
          </Button>
        </div>
      </div>
      <section className="revenue-story">
        <div className="story-copy">
          <span className="story-label">
            <Target size={13} /> THE REVENUE RECOVERY LAB <span>NEW</span>
          </span>
          <h2>
            Revenue earned.
            <br />
            <em>Cash still waiting.</em>
          </h2>
          <p>
            <strong>{formatCurrency(overdue)}</strong> is overdue
            {recovery ? ` across ${recovery.summary.overdue_account_count} customers` : ''}. Turn
            the outstanding into an action list.
          </p>
          <Link to="/recovery" className="story-cta">
            Find the next best move <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="story-ledger">
          <div className="story-ledger-label">
            <span>THE COLLECTION PICTURE</span>
            <ShieldCheck size={14} />
          </div>
          <div className="story-ledger-row">
            <span>
              <i className="ledger-marker overdue" />
              Overdue invoices
            </span>
            <strong>{formatCurrency(overdue)}</strong>
          </div>
          <div className="story-ledger-row">
            <span>
              <i className="ledger-marker upcoming" />
              Other open receivables
            </span>
            <strong>{formatCurrency(Math.max(0, d.outstanding_revenue - overdue))}</strong>
          </div>
          <div className="story-balance-track">
            <span style={{ width: `${Math.min(100, overdueShare)}%` }} />
          </div>
          <p>
            <b>{overdueShare.toFixed(1)}%</b> of your open receivables are overdue.
          </p>
          <div className="story-ledger-footer">
            <span>Real balances. Explainable priorities.</span>
            <ArrowRight size={14} />
          </div>
        </div>
      </section>
      <section className="command-metrics" aria-label="Business summary">
        {[
          {
            label: 'Monthly recurring revenue',
            value: formatCurrency(d.mrr),
            detail: `${formatCurrency(d.arr)} annualized`,
            icon: Repeat2,
          },
          {
            label: 'Active subscriptions',
            value: String(d.active_subscriptions).padStart(2, '0'),
            detail: `${d.plan_distribution.filter((p) => p.subscribers).length} plans in use`,
            icon: ShieldCheck,
          },
          {
            label: 'Collected this month',
            value: formatCurrency(d.revenue_this_month),
            detail:
              change === null
                ? 'From completed receipts'
                : `${change >= 0 ? '+' : ''}${change.toFixed(1)}% compared with last month`,
            icon: Wallet,
          },
          {
            label: 'Outstanding balance',
            value: formatCurrency(d.outstanding_revenue),
            detail: `${d.overdue_invoices} overdue invoices`,
            icon: Clock3,
          },
        ].map((metric) => (
          <article className="command-metric" key={metric.label}>
            <div>
              <span>{metric.label}</span>
              <metric.icon size={15} strokeWidth={1.5} />
            </div>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </article>
        ))}
      </section>
      <div className="command-grid">
        <section className="panel cash-chart-panel">
          <div className="command-panel-head">
            <div>
              <h2>Collected revenue</h2>
              <p>Money that reached your ledger.</p>
            </div>
            <div className="chart-tabs">
              {[6, 12].map((n) => (
                <button
                  key={n}
                  onClick={() => setMonths(n)}
                  className={months === n ? 'active' : ''}
                >
                  {n} months
                </button>
              ))}
            </div>
          </div>
          <div className="cash-chart-number">
            {formatCurrency(periodRevenue)}
            <span>over {months} months</span>
          </div>
          <div className="cash-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 15, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cash-shade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a75c40" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#a75c40" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e9ece5" strokeDasharray="3 5" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8d9788', fontSize: 10 }}
                  dy={8}
                />
                <YAxis
                  tickFormatter={formatCompactCurrency}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8d9788', fontSize: 10 }}
                  width={59}
                  tickCount={4}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Collected']}
                  contentStyle={{ border: '1px solid #dfe5d9', borderRadius: 8, fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#aa6348"
                  strokeWidth={2}
                  fill="url(#cash-shade)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="command-chart-foot">
            <span>
              <i />
              Actual receipts · INR
            </span>
            <span>Updates every 30 seconds</span>
          </div>
        </section>
        <section className="panel money-motion">
          <div className="command-panel-head">
            <div>
              <h2>Money in motion</h2>
              <p>The next few days, in one place.</p>
            </div>
            <ArrowUpRight size={16} />
          </div>
          <Link to="/billing" className="motion-row">
            <span className="motion-icon">
              <Repeat2 size={17} />
            </span>
            <div>
              <span>Ready for the next billing run</span>
              <strong>{billing ? formatCurrency(billing.total) : '—'}</strong>
              <small>{billing?.ready_count ?? '—'} contracts due to invoice</small>
            </div>
            <ChevronRight size={14} />
          </Link>
          <Link to="/invoices" className="motion-row">
            <span className="motion-icon">
              <Clock3 size={17} />
            </span>
            <div>
              <span>Invoices due in the next 7 days</span>
              <strong>
                {recovery ? formatCurrency(recovery.summary.due_next_seven_days) : '—'}
              </strong>
              <small>Outstanding issued invoices</small>
            </div>
            <ChevronRight size={14} />
          </Link>
          <Link to="/recovery" className="motion-row">
            <span className="motion-icon">
              <Flag size={17} />
            </span>
            <div>
              <span>Payment promises · next 14 days</span>
              <strong>
                {recovery ? formatCurrency(recovery.summary.promised_next_fourteen_days) : '—'}
              </strong>
              <small>{recovery?.summary.active_promises ?? 0} commitments on track</small>
            </div>
            <ChevronRight size={14} />
          </Link>
        </section>
        <section className="panel command-shortlist">
          <div className="command-panel-head">
            <div>
              <h2>Start with these conversations</h2>
              <p>A collection short list, with the reasoning attached.</p>
            </div>
            <Link to="/recovery" className="text-link">
              Open recovery lab <ArrowUpRight size={13} />
            </Link>
          </div>
          {recovery?.accounts.length ? (
            recovery.accounts.slice(0, 3).map((account, index) => (
              <Link to="/recovery" key={account.customer_id} className="shortlist-row">
                <span className="shortlist-number">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{account.company_name || account.customer_name}</strong>
                  <p>
                    {account.max_days_overdue} days overdue · {account.recommended_action}
                  </p>
                </div>
                <b>{formatCurrency(account.overdue_balance)}</b>
                <ChevronRight size={13} />
              </Link>
            ))
          ) : (
            <div className="command-no-arrears">
              <CheckCircle2 size={22} />
              <p>
                {recovery
                  ? 'No overdue balances. You’re caught up.'
                  : 'Reading the collection ledger…'}
              </p>
            </div>
          )}
          <div className="shortlist-foot">
            <Target size={12} />
            Priorities are based on invoice age, balance, and missed promises.
          </div>
        </section>
        <section className="panel command-activity">
          <div className="command-panel-head">
            <div>
              <h2>Latest in your workspace</h2>
              <p>A trace of what changed.</p>
            </div>
            <Activity size={16} />
          </div>
          {d.recent_activity.slice(0, 3).map((activity) => (
            <div className="command-activity-row" key={activity.id}>
              <span className="activity-timeline-dot" />
              <div>
                <strong>{activity.title}</strong>
                <p>{activity.description}</p>
                <small>
                  {activity.user} · {formatRelativeTime(activity.timestamp)}
                </small>
              </div>
            </div>
          ))}
        </section>
      </div>
      <div className="command-plan-strip">
        <span>YOUR SUBSCRIPTION MIX</span>
        <div>
          {d.plan_distribution.slice(0, 4).map((plan) => (
            <Link to="/subscriptions" key={plan.name}>
              {plan.name}
              <b>{plan.subscribers}</b>
            </Link>
          ))}
        </div>
        <Link to="/subscriptions" className="text-link">
          All contracts <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
