import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
export const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="workspace">
      <Sidebar
        collapsed={false}
        setCollapsed={() => {}}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="shell-main">
        <Header onToggleMobileSidebar={() => setMobileOpen(!mobileOpen)} />
        <main className="main-content">
          <Outlet />
          <footer className="page-footer">
            <span>
              © {new Date().getFullYear()} Brightloop. A little clarity for your recurring business.
            </span>
            <span className="flex items-center gap-1.5">
              <span className="live-dot" /> Local-first by design
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
};
