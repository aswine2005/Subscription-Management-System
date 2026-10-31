import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Target,
  Package,
  Layers,
  Repeat,
  FileText,
  CreditCard,
  Percent,
  Users,
  ArrowUpRight,
  ChevronDown,
  ShieldCheck,
  PanelTop,
  BookOpen,
  Settings2,
  X,
} from 'lucide-react';
import { Brand } from '../ui/Brand';
import { useAuth } from '../../hooks/useAuth';
export interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}
export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, setMobileOpen }) => {
  const { user } = useAuth();
  const groups = [
    {
      name: 'Workspace',
      items: [
        ['Overview', '/dashboard', LayoutDashboard],
        ['Recovery lab', '/recovery', Target],
        ['Billing desk', '/billing', PanelTop],
        ['Subscriptions', '/subscriptions', Repeat],
        ['Invoices', '/invoices', FileText],
        ['Payments', '/payments', CreditCard],
      ],
    },
    {
      name: 'Configuration',
      items:
        user?.role === 'admin'
          ? [
              ['Products', '/products', Package],
              ['Plans', '/plans', Layers],
              ['Discounts', '/discounts', Percent],
              ['Taxes & rules', '/taxes', Settings2],
              ['Team & customers', '/users', Users],
            ]
          : [],
    },
    { name: 'Resources', items: [['Quote templates', '/templates', BookOpen]] },
  ];
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${mobileOpen ? 'mobile-visible' : ''}`}
        aria-label="Main navigation"
      >
        <div className="sidebar-brand">
          <NavLink to="/dashboard" onClick={() => setMobileOpen(false)}>
            <Brand />
          </NavLink>
          <button
            className="ml-auto md:hidden"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={17} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-avatar">B</span>
          <div className="flex-1">
            <p className="text-[11px] font-semibold">Brightloop Software</p>
            <p className="text-[9px] text-slate-400 mt-1">Business workspace</p>
          </div>
          <ChevronDown size={12} className="text-slate-400" />
        </div>
        <nav className="overflow-y-auto">
          {groups
            .filter((g) => g.items.length)
            .map((g) => (
              <div className="nav-group" key={g.name}>
                <span className="eyebrow">{g.name}</span>
                {g.items.map(([name, to, Icon]) => {
                  const I = Icon as React.ElementType;
                  return (
                    <NavLink
                      key={String(to)}
                      to={String(to)}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                      <I />
                      <span>{String(name)}</span>
                      {to === '/recovery' && (
                        <span className="ml-auto text-[7px] px-1.5 py-0.5 rounded border border-[#65805c] text-[#9fb78b]">
                          NEW
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-[#61734c]">
              <ShieldCheck size={14} /> Your business keeps running
            </div>
            <p>
              Local database. Recurring billing.
              <br />
              Built to work without the cloud.
            </p>
            <NavLink
              to="/billing"
              className="flex items-center gap-1 text-[9px] font-medium text-[#6b7c55] mt-3"
            >
              Open billing desk <ArrowUpRight size={11} />
            </NavLink>
          </div>
          <p className="text-[9px] text-[#a3ab96] mt-5">
            BRIGHTLOOP <span className="float-right">v1.0</span>
          </p>
        </div>
      </aside>
    </>
  );
};
