import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, AuthResponse } from '../types';
import { authApi } from '../api/auth';
import { mockStore } from '../api/mockStore';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<AuthResponse>;
  register: (name: string, email: string, password: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  switchDemoRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('brightloop_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('brightloop_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // If no initial user, provide default admin user for instant hackathon demo experience
    if (!user && !token) {
      const defaultAdmin = mockStore.getUsers()[0];
      setUser(defaultAdmin);
      setToken('mock_admin_token_brightloop');
      localStorage.setItem('brightloop_user', JSON.stringify(defaultAdmin));
      localStorage.setItem('brightloop_token', 'mock_admin_token_brightloop');
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string, rememberMe?: boolean): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const data = await authApi.login(email, password);
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('brightloop_token', data.token);
      localStorage.setItem('brightloop_user', JSON.stringify(data.user));
      if (rememberMe) {
        localStorage.setItem('brightloop_remember_email', email);
      } else {
        localStorage.removeItem('brightloop_remember_email');
      }
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const data = await authApi.register(name, email, password);
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('brightloop_token', data.token);
      localStorage.setItem('brightloop_user', JSON.stringify(data.user));
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('brightloop_token');
      localStorage.removeItem('brightloop_user');
      setIsLoading(false);
    }
  };

  const switchDemoRole = (role: UserRole) => {
    const users = mockStore.getUsers();
    let target = users.find((u) => u.role === role);
    if (!target) {
      target = {
        id: `usr_demo_${role}`,
        name: `${role.toUpperCase()} Demo User`,
        email: `${role}@brightloop.io`,
        role,
        status: 'active',
      };
    }
    setUser(target);
    setToken(`demo_token_${role}`);
    localStorage.setItem('brightloop_user', JSON.stringify(target));
    localStorage.setItem('brightloop_token', `demo_token_${role}`);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
        switchDemoRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
