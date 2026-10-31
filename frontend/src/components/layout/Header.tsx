import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Menu, ChevronDown, ChevronRight, LogOut, RefreshCw, Users } from 'lucide-react';
import apiClient from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
export const Header: React.FC<{
  onToggleMobileSidebar: () => void;
  showMobileMenu?: boolean;
}> = ({ onToggleMobileSidebar, showMobileMenu = true }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: connected } = useQuery({
    queryKey: ['connection'],
    queryFn: async () => {
      await apiClient.get('/auth/me');
      return true;
    },
    refetchInterval: 30000,
    retry: false,
  });
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const title: Record<string, string> = {
    dashboard: 'Overview',
    billing: 'Billing desk',
    recovery: 'Revenue recovery lab',
    subscriptions: 'Subscriptions',
    invoices: 'Invoices',
    payments: 'Payments',
    products: 'Products',
    plans: 'Plans',
    discounts: 'Discounts',
    users: 'Team & customers',
    taxes: 'Taxes & rules',
    templates: 'Quote templates',
    portal: 'Customer portal',
  };
  return (
    <header className="topbar">
      <div className="flex items-center gap-3">
        {showMobileMenu && (
          <button
            className="md:hidden text-slate-500"
            aria-label="Open navigation"
            onClick={onToggleMobileSidebar}
          >
            <Menu size={19} />
          </button>
        )}
        <div className="topbar-crumb">
          <span>Workspace</span>
          <ChevronRight size={10} />
          <span className="text-slate-700">{title[pathname.split('/')[1]] || 'Overview'}</span>
        </div>
      </div>
      <div className="topbar-actions">
        <span className="live-indicator">
          <span className={`live-dot ${connected ? '' : '!bg-amber-500'}`} />
          {connected ? 'Connected to local database' : 'Connecting to database'}
        </span>
        <button
          title="Refresh workspace"
          aria-label="Refresh workspace"
          onClick={() => queryClient.invalidateQueries()}
          className="text-slate-400 hover:text-slate-700"
        >
          <RefreshCw size={14} />
        </button>
        <div className="relative" ref={ref}>
          <button className="profile-button" onClick={() => setOpen(!open)} aria-expanded={open}>
            <span className="profile-avatar">
              {user?.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </span>
            <span className="profile-name text-left">
              <span className="block text-[10px] font-medium">{user?.name}</span>
              <span className="block text-[8px] text-slate-400 capitalize mt-0.5">
                {user?.role}
              </span>
            </span>
            <ChevronDown size={11} className="text-slate-400" />
          </button>
          {open && (
            <div className="profile-menu">
              <div className="p-2 pb-3 text-[10px] text-slate-400 border-b border-slate-100 mb-1">
                {user?.email}
              </div>
              {user?.role === 'admin' && (
                <button
                  onClick={() => {
                    navigate('/users');
                    setOpen(false);
                  }}
                >
                  <Users size={14} />
                  Manage team
                </button>
              )}
              <button
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
