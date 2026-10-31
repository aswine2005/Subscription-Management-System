import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

export const API_BASE_URL = 'http://localhost:8000/api/v1';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request Interceptor: Attach JWT Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('brightloop_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Format responses or handle 401
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear token on unauthorized if not on auth page
      if (!window.location.pathname.includes('/auth')) {
        localStorage.removeItem('brightloop_token');
        localStorage.removeItem('brightloop_user');
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
