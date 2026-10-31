import axios from 'axios';
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
const apiClient = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('brightloop_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
apiClient.interceptors.response.use(
  (r) => r,
  (error) => {
    const detail = error.response?.data?.detail;
    error.message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => `${d.loc.slice(1).join(' ')}: ${d.msg}`).join('; ')
          : error.response
            ? 'The request could not be completed.'
            : 'Cannot reach Brightloop. Check that the local API is running.';
    if (error.response?.status === 401 && !error.config.url.includes('/auth/login')) {
      localStorage.removeItem('brightloop_token');
      localStorage.removeItem('brightloop_user');
      window.dispatchEvent(new Event('brightloop:unauthorized'));
    }
    return Promise.reject(error);
  },
);
export async function listAll(path: string, params: Record<string, any> = {}): Promise<any[]> {
  let rows: any[] = [];
  for (let page = 1; ; page++) {
    const { data } = await apiClient.get(path, { params: { ...params, page, limit: 100 } });
    rows = rows.concat(data);
    if (data.length < 100) return rows;
  }
}
export const dateTime = (value?: string) =>
  value ? (value.includes('T') ? value : `${value}T00:00:00`) : undefined;
export const matches = (value: unknown, query?: string) =>
  !query || String(value).toLowerCase().includes(query.toLowerCase());
export default apiClient;
