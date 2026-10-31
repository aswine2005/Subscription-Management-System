import { z } from 'zod';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../../api/products';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { discountSchema, DiscountFormData } from '../../utils/validators';
import { Discount } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';

export interface DiscountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DiscountFormData) => Promise<void>;
  discount?: Discount | null;
  isLoading?: boolean;
}

export const DiscountFormModal: React.FC<DiscountFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  discount,
  isLoading = false,
}) => {
  const isEditing = !!discount;
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getProducts(),
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const nextMonthStr = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<z.input<typeof discountSchema>, unknown, DiscountFormData>({
    resolver: zodResolver(discountSchema),
    defaultValues: {
      name: discount?.name || '',
      code: discount?.code || '',
      type: discount?.type || 'percentage',
      value: discount?.value || 10,
      min_purchase: discount?.min_purchase || 0,
      start_date: discount?.start_date || todayStr,
      end_date: discount?.end_date || nextMonthStr,
      max_uses: discount?.max_uses || 100,
      status: discount?.status || 'active',
    },
  });

  React.useEffect(() => {
    if (discount) {
      reset({
        name: discount.name,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        min_purchase: discount.min_purchase,
        min_quantity: discount.min_quantity || 1,
        applies_to: (discount.applies_to as 'subscription' | 'product') || 'subscription',
        product_id: discount.product_id ? String(discount.product_id) : '',
        start_date: discount.start_date?.slice(0, 10),
        end_date: discount.end_date?.slice(0, 10) || '',
        max_uses: discount.max_uses || 100,
        status: discount.status,
      });
    } else {
      reset({
        min_quantity: 1,
        applies_to: 'subscription',
        product_id: '',
        name: '',
        code: '',
        type: 'percentage',
        value: 15,
        min_purchase: 100,
        start_date: todayStr,
        end_date: nextMonthStr,
        max_uses: 100,
        status: 'active',
      });
    }
  }, [discount, reset, isOpen]);

  const handleFormSubmit = async (data: DiscountFormData) => {
    await onSubmit({
      ...data,
      code: data.code.toUpperCase(),
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Coupon & Discount' : 'Create Promotion Code'}
      description="Configure discount magnitude, coupon code, validity window, and usage cap."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit(handleFormSubmit)} isLoading={isLoading}>
            {isEditing ? 'Save Discount' : 'Create Discount'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Promotion Name"
            placeholder="e.g. Early Adopter 20% Off"
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            label="Coupon Code"
            placeholder="e.g. EARLY20"
            className="uppercase font-mono font-semibold"
            error={errors.code?.message}
            {...register('code')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Discount Type"
            options={[
              { value: 'percentage', label: 'Percentage (%)' },
              { value: 'fixed', label: 'Fixed Amount (₹)' },
            ]}
            error={errors.type?.message}
            {...register('type')}
          />

          <Input
            label="Discount Value"
            type="number"
            step="0.01"
            placeholder="15"
            error={errors.value?.message}
            {...register('value')}
          />

          <Input
            label="Min Purchase (₹)"
            type="number"
            step="0.01"
            placeholder="0"
            error={errors.min_purchase?.message}
            {...register('min_purchase')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Valid From"
            type="date"
            error={errors.start_date?.message}
            {...register('start_date')}
          />

          <Input
            label="Valid Until"
            type="date"
            error={errors.end_date?.message}
            {...register('end_date')}
          />

          <Input
            label="Max Uses"
            type="number"
            placeholder="Unlimited"
            error={errors.max_uses?.message}
            {...register('max_uses')}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Minimum quantity"
            type="number"
            min={1}
            error={errors.min_quantity?.message}
            {...register('min_quantity')}
          />
          <Select
            label="Applies to"
            options={[
              { value: 'subscription', label: 'Whole subscription' },
              { value: 'product', label: 'Specific product' },
            ]}
            {...register('applies_to')}
          />
        </div>
        {watch('applies_to') === 'product' && (
          <Select
            label="Eligible product"
            options={[
              { value: '', label: 'Select a product' },
              ...products.map((p) => ({ value: p.id, label: p.name })),
            ]}
            error={errors.product_id?.message}
            {...register('product_id')}
          />
        )}
        <Select
          label="Status"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'expired', label: 'Expired' },
            { value: 'disabled', label: 'Disabled' },
          ]}
          error={errors.status?.message}
          {...register('status')}
        />
      </form>
    </Modal>
  );
};
