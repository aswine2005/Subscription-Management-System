import React, { useEffect, useState } from 'react';
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
  } = useForm<SubscriptionFormData>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      customer_id: '',
      plan_id: '',
      start_date: todayStr,
      expiry_date: nextYearStr,
      billing_cycle: 'monthly',
      payment_terms: 'Net 30',
      quotation_template: 'Standard Enterprise Agreement',
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
    return acc + q * p;
  }, 0);
  const taxAmount = Math.round(subtotal * 0.1 * 100) / 100;
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
        quotation_template: 'Standard Enterprise Agreement',
        notes: '',
        lines: [
          {
            product_id: defaultProduct?.id || '',
            product_name: defaultProduct?.name || 'Service Item',
            variant_name: defaultProduct?.variants?.[0]?.name || '',
            quantity: 1,
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
      }
    }
  };

  const handleProductLineChange = (index: number, productId: string) => {
    setValue(`lines.${index}.product_id`, productId);
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setValue(`lines.${index}.product_name`, prod.name);
      setValue(`lines.${index}.unit_price`, prod.sales_price);
      setValue(`lines.${index}.variant_name`, prod.variants?.[0]?.name || '');
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
    onClose();
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
          <Button
            variant="primary"
            onClick={handleSubmit(handleFormSubmit)}
            isLoading={isLoading}
          >
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
            label="Billing Cycle"
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly' },
              { value: 'quarterly', label: 'Quarterly' },
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
              { value: 'Due on Receipt', label: 'Due on Receipt' },
              { value: 'Net 15', label: 'Net 15 Days' },
              { value: 'Net 30', label: 'Net 30 Days' },
              { value: 'Net 60', label: 'Net 60 Days' },
            ]}
            error={errors.payment_terms?.message}
            {...register('payment_terms')}
          />

          <Select
            label="Quotation Template"
            options={[
              { value: 'Standard Enterprise Agreement', label: 'Standard Enterprise Agreement' },
              { value: 'Global Multi-Region Contract', label: 'Global Multi-Region Contract' },
              { value: 'SaaS Startup FastTrack', label: 'SaaS Startup FastTrack' },
              { value: 'Custom SLA Addendum', label: 'Custom SLA Addendum' },
            ]}
            error={errors.quotation_template?.message}
            {...register('quotation_template')}
          />
        </div>

        {/* Subscription Lines Section */}
        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                Subscription Items & Rate Schedule
              </h5>
              <p className="text-xs text-slate-500 dark:text-slate-400">
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
                value: v.name,
                label: `${v.name} (+$${v.additional_price})`,
              }));

              const qty = Number(watchedLines[index]?.quantity) || 1;
              const up = Number(watchedLines[index]?.unit_price) || 0;
              const lineTotal = qty * up;

              return (
                <div
                  key={field.id}
                  className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2"
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
                          {...register(`lines.${index}.variant_name` as const)}
                        />
                      ) : (
                        <Input
                          label="Variant"
                          placeholder="Standard"
                          disabled
                          value="Standard"
                        />
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <Input
                        label="Quantity"
                        type="number"
                        min={1}
                        {...register(`lines.${index}.quantity` as const)}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Input
                        label="Unit Price ($)"
                        type="number"
                        step="0.01"
                        {...register(`lines.${index}.unit_price` as const)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-slate-500">
                      Line Total: <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(lineTotal)}</strong>
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
        <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-semibold text-xs">
            <Calculator className="w-4 h-4 text-indigo-500" />
            <span>Automatic Tax (10% VAT) & Subtotal Calculation</span>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="text-right">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Subtotal</span>
              <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(subtotal)}</strong>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Tax (10%)</span>
              <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(taxAmount)}</strong>
            </div>
            <div className="text-right pl-4 border-l border-indigo-200 dark:border-indigo-800">
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold block uppercase tracking-wider">
                Total
              </span>
              <strong className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                {formatCurrency(totalAmount)}
              </strong>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
