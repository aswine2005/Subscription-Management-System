import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download } from 'lucide-react';
import { invoicesApi } from '../../api/invoices';
import { useAuth } from '../../hooks/useAuth';
import { Invoice } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { SearchBar } from '../../components/ui/SearchBar';
import { Select } from '../../components/ui/Select';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const CustomerInvoices: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const customerId = user?.id || 'usr_3';

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['customer-invoices', customerId, statusFilter, search],
    queryFn: () =>
      invoicesApi.getInvoices({
        customer_id: customerId,
        status: statusFilter,
        search,
      }),
  });

  const handleDownloadInvoice = (inv: Invoice) => {
    navigate(`/portal/invoices/${inv.id}`);
  };

  const columns: Column<Invoice>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      sortable: true,
      render: (inv) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-900 font-mono">{inv.invoice_number}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'subscription_number',
      header: 'Subscription Agreement',
      render: (inv) => (
        <span className="text-xs font-mono text-indigo-600 ">
          {inv.subscription_number || 'Direct Order'}
        </span>
      ),
    },
    {
      key: 'issue_date',
      header: 'Date Issued',
      sortable: true,
      render: (inv) => <span className="text-xs">{formatDate(inv.issue_date)}</span>,
    },
    {
      key: 'due_date',
      header: 'Due Date',
      sortable: true,
      render: (inv) => <span className="text-xs">{formatDate(inv.due_date)}</span>,
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
      header: 'Amount',
      sortable: true,
      align: 'right',
      render: (inv) => (
        <div>
          <span className="font-semibold text-slate-900 ">{formatCurrency(inv.total_amount)}</span>
          {inv.balance_due > 0 && inv.status !== 'paid' && (
            <span className="block text-[11px] text-rose-500 font-semibold">
              Due: {formatCurrency(inv.balance_due)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Receipt',
      align: 'right',
      render: (inv) => (
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Download className="w-3.5 h-3.5" />}
          onClick={() => handleDownloadInvoice(inv)}
        >
          View / PDF
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 ">
            My Invoices & Receipts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Download PDF copies of past billing statements and track outstanding balances.
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-card p-4 rounded-lg">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by invoice # or details..."
          className="w-full sm:w-80"
        />

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
            Status:
          </span>
          <Select
            options={[
              { value: 'all', label: 'All Invoices' },
              { value: 'paid', label: 'Paid' },
              { value: 'confirmed', label: 'Awaiting Payment' },
              { value: 'overdue', label: 'Overdue' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        isLoading={isLoading}
        emptyTitle="No invoices found"
        emptyDescription="All billing statements will be listed here once generated."
      />
    </div>
  );
};
