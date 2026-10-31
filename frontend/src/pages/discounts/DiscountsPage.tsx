import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Tag } from 'lucide-react';
import { discountsApi } from '../../api/discounts';
import { Discount } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { DiscountFormModal } from './DiscountFormModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { showToast } from '../../components/ui/Toast';
import { DiscountFormData } from '../../utils/validators';

export const DiscountsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ['discounts'],
    queryFn: discountsApi.getDiscounts,
  });

  const createMutation = useMutation({
    mutationFn: (data: DiscountFormData) => discountsApi.createDiscount(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      showToast.success('Discount created successfully');
    },
    onError: (err: any) => {
      showToast.error(err?.message || 'Failed to create discount');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Discount> }) =>
      discountsApi.updateDiscount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      showToast.success('Discount updated successfully');
    },
    onError: (err: any) => {
      showToast.error(err?.message || 'Failed to update discount');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => discountsApi.deleteDiscount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      showToast.success('Discount deleted successfully');
    },
    onError: (err: any) => {
      showToast.error(err?.message || 'Failed to delete discount');
    },
  });

  const handleOpenCreate = () => {
    setSelectedDiscount(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (discount: Discount, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedDiscount(discount);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this discount promo?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleFormSubmit = async (formData: DiscountFormData) => {
    if (selectedDiscount) {
      await updateMutation.mutateAsync({ id: selectedDiscount.id, data: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
  };

  const columns: Column<Discount>[] = [
    {
      key: 'name',
      header: 'Name & Code',
      sortable: true,
      render: (d) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 ">{d.name}</div>
            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-indigo-600 font-semibold">
              {d.code}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (d) => (
        <span className="text-xs uppercase font-medium text-slate-600 ">{d.type}</span>
      ),
    },
    {
      key: 'value',
      header: 'Discount Value',
      sortable: true,
      align: 'right',
      render: (d) => (
        <span className="font-semibold text-indigo-600 ">
          {d.type === 'percentage' ? `${d.value}% OFF` : `-${formatCurrency(d.value)}`}
        </span>
      ),
    },
    {
      key: 'min_purchase',
      header: 'Min Purchase',
      sortable: true,
      align: 'right',
      render: (d) => (
        <span className="text-xs text-slate-600 ">
          {d.min_purchase > 0 ? formatCurrency(d.min_purchase) : 'No Min'}
        </span>
      ),
    },
    {
      key: 'valid_period',
      header: 'Valid Period',
      render: (d) => (
        <span className="text-xs text-slate-500">
          {formatDate(d.start_date)} - {formatDate(d.end_date)}
        </span>
      ),
    },
    {
      key: 'used_count',
      header: 'Uses / Cap',
      align: 'center',
      render: (d) => (
        <span className="text-xs font-semibold text-slate-700 ">
          {d.used_count} / {d.max_uses || '∞'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      align: 'center',
      render: (d) => <StatusBadge status={d.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (d) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => handleOpenEdit(d, e)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => handleDelete(d.id, e)}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 ">
            Promotions & Discounts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure coupons, campaign rate adjustments, and volume incentives.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={handleOpenCreate}
        >
          Add Discount
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={discounts}
        isLoading={isLoading}
        onRowClick={(item) => handleOpenEdit(item)}
        emptyTitle="No discounts found"
        emptyDescription="Create your first campaign coupon code."
      />

      <DiscountFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        discount={selectedDiscount}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};
