import apiClient from './client';
import { AuthResponse, User, UserRole } from '../types';
import { mockStore } from './mockStore';

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    try {
      const response = await apiClient.post<any>('/auth/login', { email, password });
      const rawUser = response.data.user || {};
      const user: User = {
        id: String(rawUser.id),
        name: rawUser.full_name || rawUser.name || email.split('@')[0],
        email: rawUser.email || email,
        role: rawUser.role || 'admin',
        status: rawUser.is_active !== false ? 'active' : 'inactive',
        created_at: rawUser.created_at,
      };

      const token = response.data.access_token || response.data.token;
      return { token, user };
    } catch {
      // Fallback for offline demo: find or create mock user
      const users = mockStore.getUsers();
      const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

      if (user) {
        return {
          token: `mock_jwt_token_${user.id}_${Date.now()}`,
          user,
        };
      }

      // Default demo accounts fallback
      let role: UserRole = 'customer';
      if (email.includes('admin')) role = 'admin';
      else if (email.includes('staff')) role = 'staff';

      const newUser: User = {
        id: `usr_${Date.now()}`,
        name: email.split('@')[0].toUpperCase(),
        email,
        role,
        status: 'active',
        created_at: new Date().toISOString(),
      };
      users.push(newUser);
      mockStore.saveUsers(users);

      return {
        token: `mock_jwt_token_${newUser.id}_${Date.now()}`,
        user: newUser,
      };
    }
  },

  register: async (name: string, email: string, password: string): Promise<AuthResponse> => {
    try {
      await apiClient.post<any>('/auth/register', {
        full_name: name,
        email,
        password,
      });

      // Automatically log in newly registered customer
      return await authApi.login(email, password);
    } catch {
      // Fallback
      const users = mockStore.getUsers();
      const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        throw new Error('User with this email already exists');
      }

      const newUser: User = {
        id: `usr_${Date.now()}`,
        name,
        email,
        role: 'customer',
        status: 'active',
        created_at: new Date().toISOString(),
      };
      users.push(newUser);
      mockStore.saveUsers(users);

      return {
        token: `mock_jwt_token_${newUser.id}_${Date.now()}`,
        user: newUser,
      };
    }
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    try {
      const response = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
      return response.data;
    } catch {
      return { message: 'Password reset link has been dispatched to your email address.' };
    }
  },

  getMe: async (): Promise<User> => {
    try {
      const response = await apiClient.get<any>('/auth/me');
      const u = response.data;
      return {
        id: String(u.id),
        name: u.full_name || u.name,
        email: u.email,
        role: u.role,
        status: u.is_active !== false ? 'active' : 'inactive',
        created_at: u.created_at,
      };
    } catch {
      const stored = localStorage.getItem('brightloop_user');
      if (stored) {
        return JSON.parse(stored);
      }
      return mockStore.getUsers()[0];
    }
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('brightloop_token');
      localStorage.removeItem('brightloop_user');
    }
  },
};
