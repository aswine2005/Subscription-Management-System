import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Play,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Filter,
} from 'lucide-react';
import apiClient from '../../api/client';
import { WorkspaceTabs } from '../../components/ui/WorkspaceTabs';
import { Button } from '../../components/ui/Button';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { showToast } from '../../components/ui/Toast';
interface BillingRow {
  id: number;
  subscription_number: string;
  customer_name: string;
  plan_name: string;
  status: string;
  reason: string;
  discount_name?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  next_billing_date?: string;
}
interface Preview {
  automation_enabled: boolean;
  ready_count: number;
  skipped_count: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  rows: BillingRow[];
}
export function BillingPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{
    generated_count: number;
    skipped_count: number;
    message: string;
  } | null>(null);
  const {
    data: p,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['billing-preview'],
    queryFn: async (): Promise<Preview> => (await apiClient.get('/invoices/billing-preview')).data,
    refetchInterval: 30000,
  });
  const run = useMutation({
    mutationFn: async () =>
      (await apiClient.post('/invoices/bulk-generate', undefined, { timeout: 120000 })).data,
    onSuccess: (d) => {
      setResult(d);
      setConfirm(false);
      qc.invalidateQueries();
      showToast.success(`${d.generated_count} draft invoices created and saved.`);
    },
  });
  const columns: Column<BillingRow>[] = [
    {
      key: 'subscription_number',
      header: 'Contract',
      render: (r) => (
        <Link to={`/subscriptions/${r.id}`} className="text-indigo-600 font-medium">
          {r.subscription_number}
        </Link>
      ),
    },
    {
      key: 'customer_name',
      header: 'Customer',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.customer_name}</p>
          <p className="text-[10px] text-slate-400 mt-1">{r.plan_name}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Readiness',
      render: (r) => (
        <div>
          <span
            className={`inline-flex items-center gap-1.5 text-[10px] ${r.status === 'ready' ? 'text-[#658047]' : 'text-slate-400'}`}
          >
            {r.status === 'ready' ? <CheckCircle2 size={12} /> : <Clock3 size={12} />} {r.reason}
          </span>
          <p className="text-[9px] text-slate-400 mt-1">
            {r.status === 'ready' ? 'Due now' : `Next: ${formatDate(r.next_billing_date)}`}
          </p>
        </div>
      ),
    },
    {
      key: 'discount_amount',
      header: 'Discount',
      align: 'right',
      render: (r) => (
        <div>
          <span>{r.discount_amount ? `−${formatCurrency(r.discount_amount)}` : '—'}</span>
          <p className="text-[9px] text-slate-400 mt-1">{r.discount_name}</p>
        </div>
      ),
    },
    {
      key: 'tax_amount',
      header: 'Tax',
      align: 'right',
      render: (r) => formatCurrency(r.tax_amount),
    },
    {
      key: 'total',
      header: 'Invoice total',
      align: 'right',
      render: (r) => <strong className="font-medium">{formatCurrency(r.total)}</strong>,
    },
  ];
  return (
    <div>
      <div className="overview-top">
        <div>
          <div className="eyebrow mb-2.5">Preview. Check. Bill.</div>
          <h1 className="page-heading">
            The billing desk<span className="text-slate-300">.</span>
          </h1>
          <p className="subtle mt-2">See exactly what happens before billing day happens.</p>
        </div>
        <Button
          variant="secondary"
          leftIcon={<RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />}
          onClick={() => refetch()}
        >
          Refresh preview
        </Button>
      </div>
      <WorkspaceTabs />
      <div className="billing-summary">
        {[
          ['Ready to invoice', p?.ready_count ?? '—'],
          ['Discounts applied', formatCurrency(p?.discount_amount)],
          ['Tax to collect', formatCurrency(p?.tax_amount)],
          ['Next run total', formatCurrency(p?.total)],
        ].map(([k, v]) => (
          <div key={String(k)}>
            <span className="eyebrow !text-[9px]">{k}</span>
            <strong className={k === 'Next run total' ? 'text-indigo-600' : ''}>{v}</strong>
          </div>
        ))}
      </div>
      <div className="panel p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-6">
        <span className="w-10 h-10 shrink-0 rounded-full bg-[#edf2e4] text-[#76925a] grid place-items-center">
          <ShieldCheck size={20} strokeWidth={1.5} />
        </span>
        <div className="flex-1">
          <h2 className="text-sm font-medium">A rehearsal, with real numbers.</h2>
          <p className="subtle text-[11px] mt-1">
            This preview does not create invoices or use up discounts. The run applies current rules
            and protects every billing period from duplicates.
          </p>
        </div>
        <Button
          leftIcon={<Play size={12} />}
          onClick={() => setConfirm(true)}
          disabled={!p?.ready_count || run.isPending}
        >
          Run billing{p?.ready_count ? ` · ${p.ready_count}` : ''}
        </Button>
      </div>
      {result && (
        <div
          role="status"
          className="mb-6 p-5 border border-[#d9e4cc] bg-[#eff4e7] rounded-lg flex gap-3"
        >
          <CheckCircle2 className="text-[#6f8a52]" size={20} />
          <div>
            <h2 className="font-medium text-sm">Billing run complete.</h2>
            <p className="subtle mt-1">{result.message}</p>
            <Link to="/invoices" className="text-link mt-3">
              Open the invoice ledger <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="flex items-center gap-2 text-xs">
          <Filter size={13} className="text-slate-400" />
          <span className="font-medium">Active contracts</span>
          <span className="text-slate-400">{p?.rows.length ?? 0}</span>
        </div>
        <div className="chart-tabs">
          {[
            ['all', 'All contracts'],
            ['ready', `Ready (${p?.ready_count ?? 0})`],
            ['skipped', `Skipped (${p?.skipped_count ?? 0})`],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className={filter === v ? 'active' : ''}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <DataTable
        columns={columns}
        data={(p?.rows || []).filter((r) => filter === 'all' || r.status === filter)}
        isLoading={isLoading}
        pageSize={8}
        emptyTitle="Nothing due right now"
        emptyDescription="Newly active contracts will appear here when they are due for billing."
      />
      <p className="subtle text-[10px] mt-4">
        {p?.automation_enabled
          ? 'Scheduled billing is on and checks due contracts every minute.'
          : 'Scheduled billing is off. Review and run billing here.'}{' '}
        Skipped rows show estimates only; they will not be charged in this run.
      </p>
      <Modal
        isOpen={confirm}
        onClose={() => !run.isPending && setConfirm(false)}
        title="Ready to run billing?"
        description="Create invoices from the current database state."
        footer={
          <>
            <Button variant="ghost" disabled={run.isPending} onClick={() => setConfirm(false)}>
              Back to preview
            </Button>
            <Button isLoading={run.isPending} onClick={() => run.mutate()}>
              Create invoices
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            The current preview contains <strong>{p?.ready_count} invoices</strong> totaling{' '}
            <strong>{formatCurrency(p?.total)}</strong>. Each invoice includes the applicable
            discount and tax rules.
          </p>
          <p className="subtle">
            No card is charged and no email is sent by this action. Review and send the invoices
            from the invoice ledger.
          </p>
        </div>
      </Modal>
    </div>
  );
}
