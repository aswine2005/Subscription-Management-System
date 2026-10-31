import apiClient from './client';
import { AuthResponse } from '../types';
import { mapUser } from './mappers';
export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post('/auth/login', { email, password });
    return { token: data.access_token, user: mapUser(data.user) };
  },
  register: async (name: string, email: string, password: string) => {
    await apiClient.post('/auth/register', { full_name: name, email, password });
    return authApi.login(email, password);
  },
  forgotPassword: async (email: string): Promise<{ message: string }> =>
    (await apiClient.post('/auth/forgot-password', { email })).data,
  getMe: async () => mapUser((await apiClient.get('/auth/me')).data),
  logout: async () => {},
};
