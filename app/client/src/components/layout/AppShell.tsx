import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ApiStatus } from '../system/ApiStatus';

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: '◫' },
  { to: '/sales', label: 'Sales', icon: '↗' },
  { to: '/expenses', label: 'Expenses', icon: '↙' },
  { to: '/accounting', label: 'Accounting', icon: '▤' },
  { to: '/reports', label: 'Reports', icon: '▥' },
];

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/sales': 'Sales',
  '/expenses': 'Expenses',
  '/accounting': 'Accounting',
  '/reports': 'Reports',
};

export function AppShell() {
  const { pathname } = useLocation();
  const title = pageTitles[pathname] ?? 'Page not found';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand" to="/dashboard" aria-label="Books home">
          <span className="brand-mark" aria-hidden="true">b.</span>
          <span>books<span className="brand-period">.</span></span>
        </NavLink>

        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ to, label, icon }) => (
            <NavLink
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              key={to}
              to={to}
            >
              <span className="nav-icon" aria-hidden="true">{icon}</span>
              {label}
              {label !== 'Dashboard' && <span className="nav-soon">SOON</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="avatar" aria-hidden="true">B</div>
          <div className="profile-copy">
            <strong>Your workspace</strong>
            <span>Getting started</span>
          </div>
          <span className="profile-menu" aria-hidden="true">···</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span><span>/</span><strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="environment-tag">DEVELOPMENT</span>
            <button className="help-button" type="button" aria-label="Help">?</button>
          </div>
        </header>

        <Outlet />
        <footer className="system-footer">
          <span>Independent Books web app</span>
          <ApiStatus />
        </footer>
      </main>
    </div>
  );
}
