import { z } from 'zod';
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Calculator } from 'lucide-react';
import { subscriptionSchema, SubscriptionFormData } from '../../utils/validators';
import { User, Plan, Product } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../utils/formatters';

export interface SubscriptionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SubscriptionFormData) => Promise<void>;
  customers: User[];
  plans: Plan[];
  products: Product[];
  isLoading?: boolean;
}

export const SubscriptionFormModal: React.FC<SubscriptionFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  customers,
  plans,
  products,
  isLoading = false,
}) => {
  const { data: taxes = [] } = useQuery({
    queryKey: ['taxes'],
    queryFn: async () => (await apiClient.get('/discounts/tax-rules')).data,
  });
  const taxRate = taxes
    .filter((t: any) => t.is_active)
    .reduce((a: number, t: any) => a + t.rate, 0);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const todayStr = new Date().toISOString().split('T')[0];
  const nextYearStr = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof subscriptionSchema>, unknown, SubscriptionFormData>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      customer_id: '',
      plan_id: '',
      start_date: todayStr,
      expiry_date: nextYearStr,
      billing_cycle: 'monthly',
      payment_terms: 'Net 30',

      notes: '',
      lines: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  const watchedLines = watch('lines') || [];

  // Recalculate financial breakdown
  const subtotal = watchedLines.reduce((acc, line) => {
    const q = Number(line.quantity) || 0;
    const p = Number(line.unit_price) || 0;
    const variant = products
      .find((p) => p.id === line.product_id)
      ?.variants.find((v) => v.id === line.variant_id);
    return acc + q * (p + (variant?.additional_price || 0));
  }, 0);
  const taxAmount = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
  const totalAmount = subtotal + taxAmount;

  // Initialize defaults on open
  useEffect(() => {
    if (isOpen) {
      const defaultCustomerId = customers[0]?.id || '';
      const defaultPlan = plans[0];
      const defaultProductId = defaultPlan?.product_id || products[0]?.id || '';
      const defaultProduct = products.find((p) => p.id === defaultProductId) || products[0];

      setSelectedPlanId(defaultPlan?.id || '');

      reset({
        customer_id: defaultCustomerId,
        plan_id: defaultPlan?.id || '',
        start_date: todayStr,
        expiry_date: nextYearStr,
        billing_cycle: defaultPlan?.billing_cycle || 'monthly',
        payment_terms: 'Net 30',

        notes: '',
        lines: [
          {
            product_id: defaultProduct?.id || '',
            product_name: defaultProduct?.name || 'Service Item',
            variant_id: '',
            quantity: defaultPlan?.min_qty || 1,
            unit_price: defaultPlan?.price || defaultProduct?.sales_price || 199,
          },
        ],
      });
    }
  }, [isOpen, customers, plans, products, reset]);

  // Handle plan change to sync default billing cycle & price
  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId);
    setValue('plan_id', planId);
    const plan = plans.find((p) => p.id === planId);
    if (plan) {
      setValue('billing_cycle', plan.billing_cycle);
      const product = products.find((p) => p.id === plan.product_id);
      if (product && fields.length > 0) {
        setValue('lines.0.product_id', product.id);
        setValue('lines.0.product_name', product.name);
        setValue('lines.0.unit_price', plan.price);
        setValue('lines.0.quantity', plan.min_qty);
        setValue('lines.0.variant_id', '');
      }
    }
  };

  const handleProductLineChange = (index: number, productId: string) => {
    setValue(`lines.${index}.product_id`, productId);
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setValue(`lines.${index}.product_name`, prod.name);
      setValue(`lines.${index}.unit_price`, prod.sales_price);
      setValue(`lines.${index}.variant_id`, '');
    }
  };

  const handleFormSubmit = async (data: SubscriptionFormData) => {
    const customer = customers.find((c) => c.id === data.customer_id);
    const plan = plans.find((p) => p.id === data.plan_id);

    await onSubmit({
      ...data,
      customer_name: customer?.name,
      plan_name: plan?.name,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Subscription"
      description="Configure customer subscription agreement, product lines, and billing terms."
      size="2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit(handleFormSubmit)} isLoading={isLoading}>
            Create Subscription
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(handleFormSubmit)}>
        {/* Customer & Plan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Customer Account"
            options={customers.map((c) => ({
              value: c.id,
              label: `${c.name} (${c.email})`,
            }))}
            error={errors.customer_id?.message}
            {...register('customer_id')}
          />

          <Select
            label="Subscription Plan"
            options={plans.map((p) => ({
              value: p.id,
              label: `${p.name} — ${formatCurrency(p.price)}/${p.billing_cycle}`,
            }))}
            value={selectedPlanId}
            onChange={(e) => handlePlanChange(e.target.value)}
            error={errors.plan_id?.message}
          />
        </div>

        {/* Dates & Billing Cycle */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Start Date"
            type="date"
            error={errors.start_date?.message}
            {...register('start_date')}
          />

          <Input
            label="Expiration Date"
            type="date"
            error={errors.expiry_date?.message}
            {...register('expiry_date')}
          />

          <Select
            label="Billing Cycle (from plan)"
            disabled
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
            ]}
            error={errors.billing_cycle?.message}
            {...register('billing_cycle')}
          />
        </div>

        {/* Payment Terms & Quotation Template */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Payment Terms"
            options={[
              { value: 'Immediate', label: 'Immediate' },
              { value: 'Net 15', label: 'Net 15 Days' },
              { value: 'Net 30', label: 'Net 30 Days' },
              { value: 'Net 60', label: 'Net 60 Days' },
            ]}
            error={errors.payment_terms?.message}
            {...register('payment_terms')}
          />

          <div className="flex flex-col justify-center text-[11px] text-slate-400 gap-2">
            <span>Preparing a standard offer?</span>
            <Link to="/templates" className="text-indigo-600" onClick={onClose}>
              Start from a saved quotation template ↗
            </Link>
          </div>
        </div>

        {/* Subscription Lines Section */}
        <div className="pt-3 border-t border-slate-200/80 ">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h5 className="text-sm font-semibold text-slate-900 ">
                Subscription Items & Rate Schedule
              </h5>
              <p className="text-xs text-slate-500 ">
                Specify recurring line items, variants, quantity, and unit prices.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                const prod = products[0];
                append({
                  product_id: prod?.id || '',
                  product_name: prod?.name || '',
                  variant_name: '',
                  quantity: 1,
                  unit_price: prod?.sales_price || 100,
                });
              }}
            >
              Add Item
            </Button>
          </div>

          <div className="space-y-2.5">
            {fields.map((field, index) => {
              const currentProdId = watchedLines[index]?.product_id;
              const currentProd = products.find((p) => p.id === currentProdId);
              const variantOptions = (currentProd?.variants || []).map((v) => ({
                value: v.id || '',
                label: `${v.name} (+${formatCurrency(v.additional_price)})`,
              }));

              const qty = Number(watchedLines[index]?.quantity) || 1;
              const up = Number(watchedLines[index]?.unit_price) || 0;
              const surcharge =
                currentProd?.variants.find((v) => v.id === watchedLines[index]?.variant_id)
                  ?.additional_price || 0;
              const lineTotal = qty * (up + surcharge);

              return (
                <div
                  key={field.id}
                  className="p-3 rounded-lg bg-slate-50/70 border border-slate-200 space-y-2"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                    <div className="sm:col-span-5">
                      <Select
                        label="Product"
                        options={products.map((p) => ({ value: p.id, label: p.name }))}
                        value={currentProdId}
                        onChange={(e) => handleProductLineChange(index, e.target.value)}
                      />
                    </div>

                    <div className="sm:col-span-3">
                      {variantOptions.length > 0 ? (
                        <Select
                          label="Variant"
                          options={[{ value: '', label: 'Default' }, ...variantOptions]}
                          {...register(`lines.${index}.variant_id` as const)}
                        />
                      ) : (
                        <Input label="Variant" placeholder="Standard" disabled value="Standard" />
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <Input
                        label="Quantity"
                        type="number"
                        min={1}
                        error={errors.lines?.[index]?.quantity?.message}
                        {...register(`lines.${index}.quantity` as const)}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Input
                        label="Base Unit Price (₹)"
                        type="number"
                        step="0.01"
                        error={errors.lines?.[index]?.unit_price?.message}
                        {...register(`lines.${index}.unit_price` as const)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-slate-500">
                      Line Total:{' '}
                      <strong className="text-slate-800 ">{formatCurrency(lineTotal)}</strong>
                    </span>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-rose-500 hover:text-rose-600 flex items-center gap-1 font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove item</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Totals Summary */}
        <div className="p-4 rounded-lg bg-indigo-50/50 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-indigo-700 font-semibold text-xs">
            <Calculator className="w-4 h-4 text-indigo-500" />
            <span>Automatic tax from active rules · discounts calculated at billing</span>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Subtotal</span>
              <strong className="text-slate-800 ">{formatCurrency(subtotal)}</strong>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Tax ({taxRate}%)</span>
              <strong className="text-slate-800 ">{formatCurrency(taxAmount)}</strong>
            </div>
            <div className="text-right pl-4 border-l border-indigo-200 ">
              <span className="text-xs text-indigo-600 font-semibold block uppercase tracking-wider">
                Total
              </span>
              <strong className="text-lg font-semibold text-indigo-600 ">
                {formatCurrency(totalAmount)}
              </strong>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
