import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Layers } from 'lucide-react';
import { plansApi } from '../../api/plans';
import { productsApi } from '../../api/products';
import { Plan } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { PlanFormModal } from './PlanFormModal';
import { formatCurrency, formatBillingCycle } from '../../utils/formatters';
import { showToast } from '../../components/ui/Toast';
import { PlanFormData } from '../../utils/validators';

export const PlansPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [productFilter, setProductFilter] = useState('all');
  const [cycleFilter, setCycleFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['plans', productFilter, cycleFilter],
    queryFn: () => plansApi.getPlans(productFilter, cycleFilter),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getProducts(),
  });

  const createMutation = useMutation({
    mutationFn: (data: PlanFormData) => plansApi.createPlan(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      showToast.success('Plan created successfully');
    },
    onError: (err: any) => {
      showToast.error(err?.message || 'Failed to create plan');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Plan> }) =>
      plansApi.updatePlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      showToast.success('Plan updated successfully');
    },
    onError: (err: any) => {
      showToast.error(err?.message || 'Failed to update plan');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => plansApi.deletePlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      showToast.success('Plan deleted successfully');
    },
    onError: (err: any) => {
      showToast.error(err?.message || 'Failed to delete plan');
    },
  });

  const handleOpenCreate = () => {
    setSelectedPlan(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (plan: Plan, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this subscription plan?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleFormSubmit = async (formData: PlanFormData) => {
    if (selectedPlan) {
      await updateMutation.mutateAsync({ id: selectedPlan.id, data: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
  };

  const columns: Column<Plan>[] = [
    {
      key: 'name',
      header: 'Plan Name',
      sortable: true,
      render: (plan) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white">{plan.name}</div>
            {plan.description && (
              <div className="text-xs text-slate-400 line-clamp-1 max-w-xs">{plan.description}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'product_name',
      header: 'Target Product',
      sortable: true,
      render: (plan) => (
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {plan.product_name || 'Standard Service'}
        </span>
      ),
    },
    {
      key: 'billing_cycle',
      header: 'Billing Cycle',
      sortable: true,
      render: (plan) => (
        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
          {formatBillingCycle(plan.billing_cycle)}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      sortable: true,
      align: 'right',
      render: (plan) => (
        <span className="font-bold text-slate-900 dark:text-white">
          {formatCurrency(plan.price)}
          <span className="text-xs font-normal text-slate-400">/{plan.billing_cycle}</span>
        </span>
      ),
    },
    {
      key: 'min_qty',
      header: 'Min Qty',
      align: 'center',
      render: (plan) => (
        <span className="text-slate-600 dark:text-slate-300 font-medium">{plan.min_qty}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      align: 'center',
      render: (plan) => <StatusBadge status={plan.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (plan) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => handleOpenEdit(plan, e)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Edit Plan"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => handleDelete(plan.id, e)}
            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
            title="Delete Plan"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const productFilterOptions = [
    { value: 'all', label: 'All Products' },
    ...products.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Subscription Plans
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pricing packages, billing recurrence, and contract lifecycle policies.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={handleOpenCreate}
        >
          Add Plan
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-card p-4 rounded-2xl">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
              Product:
            </span>
            <Select
              options={productFilterOptions}
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-52"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
              Billing Cycle:
            </span>
            <Select
              options={[
                { value: 'all', label: 'All Cycles' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly' },
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'weekly', label: 'Weekly' },
              ]}
              value={cycleFilter}
              onChange={(e) => setCycleFilter(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      {/* Plans DataTable */}
      <DataTable
        columns={columns}
        data={plans}
        isLoading={plansLoading}
        onRowClick={(item) => handleOpenEdit(item)}
        emptyTitle="No plans found"
        emptyDescription="Create your first subscription billing plan or adjust filters."
      />

      {/* Plan Form Modal */}
      <PlanFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        plan={selectedPlan}
        products={products}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};
