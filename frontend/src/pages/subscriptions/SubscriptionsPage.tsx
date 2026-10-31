import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Repeat, Eye, Play, Pause, XCircle } from 'lucide-react';
import { subscriptionsApi } from '../../api/subscriptions';
import { dashboardApi } from '../../api/dashboard';
import { plansApi } from '../../api/plans';
import { productsApi } from '../../api/products';
import { Subscription } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { SearchBar } from '../../components/ui/SearchBar';
import { Select } from '../../components/ui/Select';
import { SubscriptionFormModal } from './SubscriptionFormModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { showToast } from '../../components/ui/Toast';
import { SubscriptionFormData } from '../../utils/validators';

export const SubscriptionsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['subscriptions', statusFilter, search],
    queryFn: () => subscriptionsApi.getSubscriptions({ status: statusFilter, search }),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: dashboardApi.getUsers,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: () => plansApi.getPlans(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getProducts(),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Subscription>) => subscriptionsApi.createSubscription(data),
    onSuccess: (newSub) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      showToast.success(`Subscription ${newSub.subscription_number} created successfully`);
    },
    onError: (err: any) => {
      showToast.error(err?.message || 'Failed to create subscription');
    },
  });

  const advanceMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.advanceStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      showToast.success('Subscription status advanced');
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.pauseSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      showToast.success('Subscription pause status toggled');
    },
  });

  const handleRowClick = (sub: Subscription) => {
    navigate(`/subscriptions/${sub.id}`);
  };

  const handleCreateSubmit = async (formData: SubscriptionFormData) => {
    await createMutation.mutateAsync(formData as any);
  };

  const columns: Column<Subscription>[] = [
    {
      key: 'subscription_number',
      header: 'Sub #',
      sortable: true,
      render: (sub) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Repeat className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400">
            {sub.subscription_number}
          </span>
        </div>
      ),
    },
    {
      key: 'customer_name',
      header: 'Customer',
      sortable: true,
      render: (sub) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{sub.customer_name}</div>
          <div className="text-xs text-slate-400">{sub.customer_email}</div>
        </div>
      ),
    },
    {
      key: 'plan_name',
      header: 'Plan',
      sortable: true,
      render: (sub) => (
        <div>
          <span className="font-medium text-slate-800 dark:text-slate-200">{sub.plan_name}</span>
          <span className="block text-[11px] text-slate-400 capitalize">{sub.billing_cycle}</span>
        </div>
      ),
    },
    {
      key: 'start_date',
      header: 'Start Date',
      sortable: true,
      render: (sub) => <span className="text-xs">{formatDate(sub.start_date)}</span>,
    },
    {
      key: 'expiry_date',
      header: 'Expiry Date',
      sortable: true,
      render: (sub) => <span className="text-xs">{formatDate(sub.expiry_date)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      align: 'center',
      render: (sub) => <StatusBadge status={sub.status} size="sm" />,
    },
    {
      key: 'total_amount',
      header: 'Total',
      sortable: true,
      align: 'right',
      render: (sub) => (
        <span className="font-bold text-slate-900 dark:text-white">
          {formatCurrency(sub.total_amount)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (sub) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => navigate(`/subscriptions/${sub.id}`)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {sub.status !== 'active' && sub.status !== 'closed' && (
            <button
              type="button"
              onClick={() => advanceMutation.mutate(sub.id)}
              className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
              title="Advance to next state"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          {sub.status === 'active' && (
            <button
              type="button"
              onClick={() => pauseMutation.mutate(sub.id)}
              className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
              title="Pause Subscription"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
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
            Subscriptions
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Active customer subscriptions, recurring terms, and quotation pipelines.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsModalOpen(true)}
        >
          Create Subscription
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-card p-4 rounded-2xl">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by subscription #, customer, or plan..."
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
              { value: 'quotation', label: 'Quotation' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
              { value: 'closed', label: 'Closed' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {/* Subscriptions DataTable */}
      <DataTable
        columns={columns}
        data={subscriptions}
        isLoading={isLoading}
        onRowClick={handleRowClick}
        emptyTitle="No subscriptions found"
        emptyDescription="Create a new subscription agreement or adjust status filter."
      />

      {/* Create Modal */}
      <SubscriptionFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateSubmit}
        customers={users.filter((u) => u.role === 'customer')}
        plans={plans}
        products={products}
        isLoading={createMutation.isPending}
      />
    </div>
  );
};
