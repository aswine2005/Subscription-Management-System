import { z } from 'zod';
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { planSchema, PlanFormData } from '../../utils/validators';
import { Plan, Product } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';

export interface PlanFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PlanFormData) => Promise<void>;
  plan?: Plan | null;
  products: Product[];
  isLoading?: boolean;
}

export const PlanFormModal: React.FC<PlanFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  plan,
  products,
  isLoading = false,
}) => {
  const isEditing = !!plan;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof planSchema>, unknown, PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      available_from: plan?.available_from?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      available_to: plan?.available_to?.slice(0, 10) || '',
      name: plan?.name || '',
      product_id: plan?.product_id || (products[0]?.id ?? ''),
      billing_cycle: plan?.billing_cycle || 'monthly',
      price: plan?.price || 99,
      min_qty: plan?.min_qty || 1,
      auto_close: plan?.auto_close ?? false,
      allow_early_close: plan?.allow_early_close ?? false,
      allow_pause: plan?.allow_pause ?? true,
      allow_renewal: plan?.allow_renewal ?? true,
      status: plan?.status || 'active',
      description: plan?.description || '',
    },
  });

  React.useEffect(() => {
    if (plan) {
      reset({
        available_from: plan.available_from?.slice(0, 10),
        available_to: plan.available_to?.slice(0, 10) || '',
        name: plan.name,
        product_id: plan.product_id,
        billing_cycle: plan.billing_cycle,
        price: plan.price,
        min_qty: plan.min_qty,
        auto_close: plan.auto_close,
        allow_early_close: plan.allow_early_close,
        allow_pause: plan.allow_pause,
        allow_renewal: plan.allow_renewal,
        status: plan.status,
        description: plan.description || '',
      });
    } else {
      reset({
        available_from: new Date().toISOString().slice(0, 10),
        available_to: '',
        name: '',
        product_id: products[0]?.id || '',
        billing_cycle: 'monthly',
        price: 99,
        min_qty: 1,
        auto_close: false,
        allow_early_close: false,
        allow_pause: true,
        allow_renewal: true,
        status: 'active',
        description: '',
      });
    }
  }, [plan, reset, isOpen, products]);

  const handleFormSubmit = async (data: PlanFormData) => {
    await onSubmit(data);
    onClose();
  };

  const productOptions = products.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
      description="Configure billing interval, pricing tier, and policy constraints."
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit(handleFormSubmit)} isLoading={isLoading}>
            {isEditing ? 'Save Plan' : 'Create Plan'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Plan Name"
            placeholder="e.g. Enterprise Annual Elite"
            error={errors.name?.message}
            {...register('name')}
          />

          <Select
            label="Target Product"
            options={productOptions}
            error={errors.product_id?.message}
            {...register('product_id')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Billing Cycle"
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
            ]}
            error={errors.billing_cycle?.message}
            {...register('billing_cycle')}
          />

          <Input
            label="Price per Cycle (₹)"
            type="number"
            step="0.01"
            placeholder="0.00"
            error={errors.price?.message}
            {...register('price')}
          />

          <Input
            label="Minimum Quantity"
            type="number"
            min={1}
            placeholder="1"
            error={errors.min_qty?.message}
            {...register('min_qty')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Available from" type="date" {...register('available_from')} />
          <Input label="Available until (optional)" type="date" {...register('available_to')} />
        </div>
        {/* Policy Toggles */}
        <div className="pt-3 border-t border-slate-200/80 ">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Subscription Policies & Lifecycle Rules
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer hover:border-indigo-500/50 transition-colors">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                {...register('allow_renewal')}
              />
              <div>
                <span className="text-xs font-semibold text-slate-800 ">Allow Renewal</span>
                <p className="text-[11px] text-slate-500 ">
                  Allow the customer or team to extend this contract.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer hover:border-indigo-500/50 transition-colors">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                {...register('allow_pause')}
              />
              <div>
                <span className="text-xs font-semibold text-slate-800 ">Allow Pausing</span>
                <p className="text-[11px] text-slate-500 ">
                  Customers/Staff can temporarily pause contract without forfeiture.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer hover:border-indigo-500/50 transition-colors">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                {...register('allow_early_close')}
              />
              <div>
                <span className="text-xs font-semibold text-slate-800 ">Allow Early Close</span>
                <p className="text-[11px] text-slate-500 ">
                  Allow subscription termination prior to formal contract expiry.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer hover:border-indigo-500/50 transition-colors">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                {...register('auto_close')}
              />
              <div>
                <span className="text-xs font-semibold text-slate-800 ">Auto-Close at Expiry</span>
                <p className="text-[11px] text-slate-500 ">
                  Instantly close and disable services upon expiration date.
                </p>
              </div>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
};
