import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, DollarSign, Calendar, TrendingUp, CheckCircle2 } from 'lucide-react';
import { paymentsApi } from '../../api/payments';
import { invoicesApi } from '../../api/invoices';
import { PaymentRecord } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { SearchBar } from '../../components/ui/SearchBar';
import { Select } from '../../components/ui/Select';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export const PaymentsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', methodFilter, search],
    queryFn: () => paymentsApi.getPayments({ method: methodFilter, search }),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.getInvoices(),
  });

  // Calculate summary metrics
  const totalReceived = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const thisMonthReceived = payments
    .filter((p) => p.payment_date?.startsWith('2026-03') || p.payment_date?.startsWith('2026-04'))
    .reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalOutstanding = invoices.reduce((acc, inv) => acc + (inv.balance_due || 0), 0);

  const columns: Column<PaymentRecord>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      sortable: true,
      render: (p) => (
        <span className="font-bold text-slate-900 dark:text-white font-mono">
          {p.invoice_number}
        </span>
      ),
    },
    {
      key: 'customer_name',
      header: 'Customer',
      sortable: true,
      render: (p) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {p.customer_name || 'Enterprise Account'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      align: 'right',
      render: (p) => (
        <span className="font-black text-emerald-600 dark:text-emerald-400">
          {formatCurrency(p.amount)}
        </span>
      ),
    },
    {
      key: 'payment_method',
      header: 'Method',
      sortable: true,
      render: (p) => (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 uppercase">
          {p.payment_method.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'payment_date',
      header: 'Date & Time',
      sortable: true,
      render: (p) => <span className="text-xs text-slate-500">{formatDateTime(p.payment_date)}</span>,
    },
    {
      key: 'reference_number',
      header: 'Reference',
      render: (p) => (
        <span className="text-xs font-mono text-slate-500">{p.reference_number || '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: () => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Settled</span>
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Payment Transactions
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Settlement records, incoming customer wires, and payment gateways.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard
          label="Total Received (All-Time)"
          value={formatCurrency(totalReceived)}
          icon={<DollarSign className="w-6 h-6" />}
          iconColor="emerald"
        />
        <StatCard
          label="Collected This Cycle"
          value={formatCurrency(thisMonthReceived)}
          change={12.4}
          changeLabel="vs last month"
          icon={<TrendingUp className="w-6 h-6" />}
          iconColor="indigo"
        />
        <StatCard
          label="Total Balance Outstanding"
          value={formatCurrency(totalOutstanding)}
          icon={<CreditCard className="w-6 h-6" />}
          iconColor="amber"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-card p-4 rounded-2xl">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by invoice #, customer, reference..."
          className="w-full sm:w-96"
        />

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
            Payment Method:
          </span>
          <Select
            options={[
              { value: 'all', label: 'All Methods' },
              { value: 'credit_card', label: 'Credit Card' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'stripe', label: 'Stripe' },
              { value: 'paypal', label: 'PayPal' },
            ]}
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="w-48"
          />
        </div>
      </div>

      {/* Payments DataTable */}
      <DataTable
        columns={columns}
        data={payments}
        isLoading={paymentsLoading}
        emptyTitle="No payment records found"
        emptyDescription="Transactions will appear here when invoices are paid."
      />
    </div>
  );
};
