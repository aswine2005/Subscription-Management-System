import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Package } from 'lucide-react';
import { productsApi } from '../../api/products';
import { Product, ProductType } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { SearchBar } from '../../components/ui/SearchBar';
import { Select } from '../../components/ui/Select';
import { ProductFormModal } from './ProductFormModal';
import { formatCurrency } from '../../utils/formatters';
import { showToast } from '../../components/ui/Toast';
import { ProductFormData } from '../../utils/validators';

export const ProductsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', search, typeFilter],
    queryFn: () => productsApi.getProducts(search, typeFilter),
  });

  const createMutation = useMutation({
    mutationFn: (data: ProductFormData) => productsApi.createProduct(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showToast.success('Product created successfully');
    },
    onError: (err: any) => {
      showToast.error(err?.message || 'Failed to create product');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      productsApi.updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showToast.success('Product updated successfully');
    },
    onError: (err: any) => {
      showToast.error(err?.message || 'Failed to update product');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showToast.success('Product deleted successfully');
    },
    onError: (err: any) => {
      showToast.error(err?.message || 'Failed to delete product');
    },
  });

  const handleOpenCreate = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this product?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleFormSubmit = async (formData: ProductFormData) => {
    if (selectedProduct) {
      await updateMutation.mutateAsync({ id: selectedProduct.id, data: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
  };

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product Name',
      sortable: true,
      render: (product) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white">{product.name}</div>
            {product.description && (
              <div className="text-xs text-slate-400 line-clamp-1 max-w-xs">
                {product.description}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (product) => <StatusBadge status={product.type} size="sm" />,
    },
    {
      key: 'sales_price',
      header: 'Sales Price',
      sortable: true,
      align: 'right',
      render: (product) => (
        <span className="font-bold text-slate-900 dark:text-white">
          {formatCurrency(product.sales_price)}
        </span>
      ),
    },
    {
      key: 'cost_price',
      header: 'Cost Price',
      sortable: true,
      align: 'right',
      render: (product) => (
        <span className="text-slate-500 dark:text-slate-400">
          {formatCurrency(product.cost_price)}
        </span>
      ),
    },
    {
      key: 'variants',
      header: 'Variants',
      render: (product) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {product.variants && product.variants.length > 0 ? (
            product.variants.map((v, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
              >
                {v.name} (+${v.additional_price})
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400">Standard</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      align: 'center',
      render: (product) => <StatusBadge status={product.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (product) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => handleOpenEdit(product, e)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Edit Product"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => handleDelete(product.id, e)}
            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
            title="Delete Product"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Product Catalog
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure subscription items, rate cards, and variant tiers.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={handleOpenCreate}
        >
          Add Product
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-card p-4 rounded-2xl">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search products by name or details..."
          className="w-full sm:w-80"
        />

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
            Type:
          </span>
          <Select
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'service', label: 'Service' },
              { value: 'goods', label: 'Physical Goods' },
              { value: 'digital', label: 'Digital License' },
            ]}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {/* Products DataTable */}
      <DataTable
        columns={columns}
        data={products}
        isLoading={isLoading}
        onRowClick={(item) => handleOpenEdit(item)}
        emptyTitle="No products found"
        emptyDescription="Create your first subscription product or adjust search filters."
      />

      {/* Create / Edit Modal */}
      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        product={selectedProduct}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};
