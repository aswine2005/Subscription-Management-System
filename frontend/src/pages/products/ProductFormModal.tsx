import { z } from 'zod';
import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Layers } from 'lucide-react';
import { productSchema, ProductFormData } from '../../utils/validators';
import { Product } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';

export interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProductFormData) => Promise<void>;
  product?: Product | null;
  isLoading?: boolean;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  product,
  isLoading = false,
}) => {
  const isEditing = !!product;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof productSchema>, unknown, ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || '',
      type: product?.type || 'service',
      sales_price: product?.sales_price || 0,
      cost_price: product?.cost_price || 0,
      status: product?.status || 'active',
      description: product?.description || '',
      variants: product?.variants || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variants',
  });

  React.useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        type: product.type,
        sales_price: product.sales_price,
        cost_price: product.cost_price,
        status: product.status,
        description: product.description || '',
        variants: product.variants || [],
      });
    } else {
      reset({
        name: '',
        type: 'service',
        sales_price: 99,
        cost_price: 20,
        status: 'active',
        description: '',
        variants: [],
      });
    }
  }, [product, reset, isOpen]);

  const handleFormSubmit = async (data: ProductFormData) => {
    await onSubmit(data);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Product' : 'Create New Product'}
      description="Define product configuration, pricing model, and optional multi-attribute variants."
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit(handleFormSubmit)} isLoading={isLoading}>
            {isEditing ? 'Save Changes' : 'Create Product'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Product Name"
            placeholder="e.g. Enterprise Infrastructure"
            error={errors.name?.message}
            {...register('name')}
          />

          <Select
            label="Product Type"
            options={[
              { value: 'service', label: 'Service' },
              { value: 'software', label: 'Software' },
              { value: 'addon', label: 'Add-on' },
            ]}
            error={errors.type?.message}
            {...register('type')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Sales Price (₹)"
            type="number"
            step="0.01"
            placeholder="0.00"
            error={errors.sales_price?.message}
            {...register('sales_price')}
          />

          <Input
            label="Cost Price (₹)"
            type="number"
            step="0.01"
            placeholder="0.00"
            error={errors.cost_price?.message}
            {...register('cost_price')}
          />

          <Select
            label="Status"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
            ]}
            error={errors.status?.message}
            {...register('status')}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
            Description
          </label>
          <textarea
            rows={3}
            placeholder="Detailed description of features, tier limits, or service agreement..."
            className="w-full rounded-lg p-3 text-sm bg-slate-50/90 text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            {...register('description')}
          />
        </div>

        {/* Variants Management Section */}
        <div className="pt-3 border-t border-slate-200/80 ">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h5 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-500" />
                <span>Product Variants & Add-ons</span>
              </h5>
              <p className="text-xs text-slate-500 ">
                Configure tier upgrades or attribute options with supplemental pricing.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => append({ name: '', additional_price: 0 })}
            >
              Add Variant
            </Button>
          </div>

          {fields.length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-400">
              No variants defined. Click &ldquo;Add Variant&rdquo; if this product offers tier
              levels.
            </div>
          ) : (
            <div className="space-y-2.5">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex items-center gap-2 bg-slate-50/70 p-2.5 rounded-lg border border-slate-200 "
                >
                  <div className="flex-1">
                    <Input
                      placeholder="Variant Name (e.g. 50 Nodes)"
                      {...register(`variants.${index}.name` as const)}
                      error={errors.variants?.[index]?.name?.message}
                    />
                  </div>
                  <div className="w-36">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="+ Price"
                      {...register(`variants.${index}.additional_price` as const)}
                      error={errors.variants?.[index]?.additional_price?.message}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};
