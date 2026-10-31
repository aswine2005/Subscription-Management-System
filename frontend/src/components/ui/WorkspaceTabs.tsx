import { NavLink } from 'react-router-dom';
export const WorkspaceTabs = () => (
  <nav className="workspace-tabs" aria-label="Workspace views">
    {[
      ['Overview', '/dashboard'],
      ['Billing desk', '/billing'],
      ['Subscriptions', '/subscriptions'],
    ].map(([label, to]) => (
      <NavLink key={to} to={to}>
        {label}
      </NavLink>
    ))}
  </nav>
);
