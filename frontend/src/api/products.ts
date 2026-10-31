import apiClient from './client';
import { Product } from '../types';
import { mockStore } from './mockStore';

export const productsApi = {
  getProducts: async (search?: string, type?: string): Promise<Product[]> => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (type && type !== 'all') params.append('type', type);
      const res = await apiClient.get<any[]>('/products/', { params });
      return res.data.map((p: any) => ({
        id: String(p.id),
        name: p.name,
        type: p.type,
        sales_price: p.sales_price,
        cost_price: p.cost_price,
        status: p.is_active !== false ? 'active' : 'archived',
        description: p.description,
        variants: (p.variants || []).map((v: any) => ({
          id: String(v.id),
          name: v.name,
          additional_price: v.additional_price,
        })),
        created_at: p.created_at,
      }));
    } catch {
      let products = mockStore.getProducts();
      if (search) {
        const query = search.toLowerCase();
        products = products.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.description?.toLowerCase().includes(query)
        );
      }
      if (type && type !== 'all') {
        products = products.filter((p) => p.type === type);
      }
      return products;
    }
  },

  getProductById: async (id: string): Promise<Product> => {
    try {
      const res = await apiClient.get<any>(`/products/${id}`);
      const p = res.data;
      return {
        id: String(p.id),
        name: p.name,
        type: p.type,
        sales_price: p.sales_price,
        cost_price: p.cost_price,
        status: p.is_active !== false ? 'active' : 'archived',
        description: p.description,
        variants: (p.variants || []).map((v: any) => ({
          id: String(v.id),
          name: v.name,
          additional_price: v.additional_price,
        })),
        created_at: p.created_at,
      };
    } catch {
      const product = mockStore.getProducts().find((p) => p.id === id);
      if (!product) throw new Error('Product not found');
      return product;
    }
  },

  createProduct: async (data: Omit<Product, 'id' | 'created_at'>): Promise<Product> => {
    try {
      const res = await apiClient.post<any>('/products/', {
        name: data.name,
        type: data.type,
        sales_price: data.sales_price,
        cost_price: data.cost_price,
        description: data.description,
        is_active: data.status === 'active',
        variants: (data.variants || []).map((v) => ({
          name: v.name,
          additional_price: v.additional_price,
        })),
      });
      return await productsApi.getProductById(String(res.data.id));
    } catch {
      const products = mockStore.getProducts();
      const newProduct: Product = {
        ...data,
        id: `prod_${Date.now()}`,
        created_at: new Date().toISOString(),
        variants: (data.variants || []).map((v, i) => ({
          ...v,
          id: v.id || `var_${Date.now()}_${i}`,
        })),
      };
      products.unshift(newProduct);
      mockStore.saveProducts(products);
      return newProduct;
    }
  },

  updateProduct: async (id: string, data: Partial<Product>): Promise<Product> => {
    try {
      await apiClient.put<any>(`/products/${id}`, {
        name: data.name,
        type: data.type,
        sales_price: data.sales_price,
        cost_price: data.cost_price,
        description: data.description,
        is_active: data.status ? data.status === 'active' : undefined,
      });
      return await productsApi.getProductById(id);
    } catch {
      const products = mockStore.getProducts();
      const index = products.findIndex((p) => p.id === id);
      if (index === -1) throw new Error('Product not found');
      const updated: Product = {
        ...products[index],
        ...data,
        variants: data.variants
          ? data.variants.map((v, i) => ({
              ...v,
              id: v.id || `var_${Date.now()}_${i}`,
            }))
          : products[index].variants,
      };
      products[index] = updated;
      mockStore.saveProducts(products);
      return updated;
    }
  },

  deleteProduct: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/products/${id}`);
    } catch {
      const products = mockStore.getProducts().filter((p) => p.id !== id);
      mockStore.saveProducts(products);
    }
  },
};
