import apiClient, { listAll, matches } from './client';
import { Product } from '../types';
import { mapProduct } from './mappers';
const payload = (d: Partial<Product>) => ({
  ...d,
  is_active: d.status ? d.status === 'active' : undefined,
});
export const productsApi = {
  getProducts: async (search?: string, type?: string): Promise<Product[]> =>
    (await listAll('/products/'))
      .map(mapProduct)
      .filter(
        (p) =>
          matches(`${p.name} ${p.description}`, search) &&
          (!type || type === 'all' || p.type === type),
      ),
  getProductById: async (id: string) => mapProduct((await apiClient.get(`/products/${id}`)).data),
  createProduct: async (data: Omit<Product, 'id' | 'created_at'>) =>
    mapProduct((await apiClient.post('/products/', payload(data))).data),
  updateProduct: async (id: string, data: Partial<Product>) =>
    mapProduct((await apiClient.put(`/products/${id}`, payload(data))).data),
  deleteProduct: async (id: string) => {
    await apiClient.delete(`/products/${id}`);
  },
};
