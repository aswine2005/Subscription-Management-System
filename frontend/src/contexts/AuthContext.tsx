import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, AuthResponse } from '../types';
import { authApi } from '../api/auth';
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<AuthResponse>;
  register: (name: string, email: string, password: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('brightloop_token'));
  const [isLoading, setIsLoading] = useState(true);
  const clear = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('brightloop_token');
    localStorage.removeItem('brightloop_user');
    queryClient.clear();
  };
  useEffect(() => {
    if (token && !token.includes('mock') && !token.includes('demo_token'))
      authApi
        .getMe()
        .then(setUser)
        .catch(clear)
        .finally(() => setIsLoading(false));
    else {
      clear();
      setIsLoading(false);
    }
    window.addEventListener('brightloop:unauthorized', clear);
    return () => window.removeEventListener('brightloop:unauthorized', clear);
  }, []);
  const accept = (data: AuthResponse) => {
    queryClient.clear();
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('brightloop_token', data.token);
    return data;
  };
  const login = async (email: string, password: string, rememberMe?: boolean) => {
    const data = accept(await authApi.login(email, password));
    if (rememberMe) localStorage.setItem('brightloop_remember_email', email);
    else localStorage.removeItem('brightloop_remember_email');
    return data;
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        register: async (name, email, password) =>
          accept(await authApi.register(name, email, password)),
        logout: async () => clear(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider required');
  return ctx;
};
