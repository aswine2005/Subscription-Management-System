import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Brand } from '../ui/Brand';
import { Header } from './Header';
export const CustomerLayout: React.FC = () => (
  <div className="min-h-screen bg-slate-50">
    <div className="bg-white border-b border-slate-200 px-5 sm:px-9 py-5 flex flex-wrap items-center gap-6">
      <Brand />
      <span className="text-[10px] text-slate-400 mr-auto">CUSTOMER PORTAL</span>
      <nav className="flex gap-6 text-xs">
        {[
          ['Overview', '/portal'],
          ['Subscriptions', '/portal/subscriptions'],
          ['Invoices', '/portal/invoices'],
        ].map(([label, to]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/portal'}
            className={({ isActive }) =>
              isActive ? 'text-indigo-600 font-semibold' : 'text-slate-500'
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
    <Header onToggleMobileSidebar={() => {}} showMobileMenu={false} />
    <main className="main-content">
      <Outlet />
    </main>
  </div>
);
