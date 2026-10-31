import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileText, Zap, Eye, Calendar, DollarSign } from 'lucide-react';
import { invoicesApi } from '../../api/invoices';
import { Invoice } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { SearchBar } from '../../components/ui/SearchBar';
import { Select } from '../../components/ui/Select';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { showToast } from '../../components/ui/Toast';

export const InvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', statusFilter, search],
    queryFn: () => invoicesApi.getInvoices({ status: statusFilter, search }),
  });

  const generateMutation = useMutation({
    mutationFn: () => invoicesApi.generateInvoices(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      showToast.success(result.message);
    },
    onError: (err: any) => {
      showToast.error(err?.message || 'Failed to generate recurring invoices');
    },
  });

  const columns: Column<Invoice>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      sortable: true,
      render: (inv) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400">
              {inv.invoice_number}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'customer_name',
      header: 'Customer',
      sortable: true,
      render: (inv) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{inv.customer_name}</span>
          <span className="block text-xs text-slate-400">{inv.customer_email}</span>
        </div>
      ),
    },
    {
      key: 'subscription_number',
      header: 'Subscription',
      sortable: true,
      render: (inv) => (
        <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
          {inv.subscription_number || 'Direct Order'}
        </span>
      ),
    },
    {
      key: 'issue_date',
      header: 'Issue Date',
      sortable: true,
      render: (inv) => <span className="text-xs">{formatDate(inv.issue_date)}</span>,
    },
    {
      key: 'due_date',
      header: 'Due Date',
      sortable: true,
      render: (inv) => (
        <span className="text-xs flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          {formatDate(inv.due_date)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      align: 'center',
      render: (inv) => <StatusBadge status={inv.status} size="sm" />,
    },
    {
      key: 'total_amount',
      header: 'Total',
      sortable: true,
      align: 'right',
      render: (inv) => (
        <div>
          <span className="font-bold text-slate-900 dark:text-white">
            {formatCurrency(inv.total_amount)}
          </span>
          {inv.balance_due > 0 && inv.status !== 'paid' && (
            <span className="block text-[11px] text-rose-500 font-medium">
              Due: {formatCurrency(inv.balance_due)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (inv) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => navigate(`/invoices/${inv.id}`)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="View Invoice Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Invoices & Billing
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Accounts receivable, recurring billing runs, and payment collection.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Zap className="w-4 h-4" />}
          onClick={() => generateMutation.mutate()}
          isLoading={generateMutation.isPending}
        >
          Generate Invoices
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-card p-4 rounded-2xl">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by invoice #, customer, or subscription..."
          className="w-full sm:w-96"
        />

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
            Status:
          </span>
          <Select
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'paid', label: 'Paid' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {/* Invoices DataTable */}
      <DataTable
        columns={columns}
        data={invoices}
        isLoading={isLoading}
        onRowClick={(item) => navigate(`/invoices/${item.id}`)}
        emptyTitle="No invoices found"
        emptyDescription="Run invoice generation or adjust filters."
      />
    </div>
  );
};
