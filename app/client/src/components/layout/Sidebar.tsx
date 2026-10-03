import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/auth/AuthContext';
import { useWorkspace } from '../../app/workspace/WorkspaceContext';
import { AppIcon } from '../ui/AppIcon';
import { isNavigationItemActive, navigationGroups } from './navigation';

export function Sidebar({
  open,
  onHide,
}: {
  open: boolean;
  onHide: () => void;
}) {
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { company } = useWorkspace();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const activeGroup = navigationGroups.find((group) =>
    group.items.some((item) =>
      (!item.roles || item.roles.includes(user?.role ?? '')) &&
      isNavigationItemActive(pathname, item, hash),
    ),
  );

  async function handleSignOut() {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (cause) {
      setSignOutError(
        cause instanceof Error ? cause.message : 'Could not sign out. Please try again.',
      );
    }
  }

  return (
    <aside
      aria-hidden={!open}
      aria-label="Main navigation"
      className="sidebar"
      inert={!open}
    >
      <details className="sidebar-identity">
        <summary aria-label="Account menu" className="brand">
          <span className="brand-mark" aria-hidden="true">
            {(company?.name.slice(0, 1) ?? 'B').toUpperCase()}
          </span>
          <span className="brand-copy">
            <strong>{company?.name ?? 'Books'}</strong>
            <small>{user?.fullname ?? user?.email ?? 'Workspace'}</small>
          </span>
          <AppIcon className="brand-chevron" name="chevronDown" size={16} />
        </summary>
        <div className="sidebar-account-menu" role="menu">
          {signOutError && <div className="form-alert" role="alert">{signOutError}</div>}
          <button
            className="sidebar-account-action"
            onClick={() => void handleSignOut()}
            role="menuitem"
            type="button"
          >
            <AppIcon name="user" size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </details>

      <nav className="sidebar-navigation">
        <NavLink
          aria-label="Dashboard"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          end
          to="/dashboard"
        >
          <span className="nav-icon"><AppIcon name="dashboard" /></span>
          <span className="nav-label">Dashboard</span>
        </NavLink>
        {navigationGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.roles || item.roles.includes(user?.role ?? ''),
          );
          const active = activeGroup?.label === group.label;
          const destination = visibleItems[0];
          if (!destination) return null;
          return (
            <div className="sidebar-group" key={group.label}>
              <NavLink
                aria-expanded={active}
                aria-label={group.label}
                className={`nav-item sidebar-group-heading${active && visibleItems.length === 1 ? ' active' : ''}`}
                end={visibleItems.length === 1}
                to={destination.to}
              >
                <span className="nav-icon"><AppIcon name={group.icon} /></span>
                <span className="nav-label">{group.label}</span>
                {visibleItems.length > 1 && (
                  <AppIcon
                    className={`nav-chevron${active ? ' expanded' : ''}`}
                    name="chevron"
                    size={14}
                  />
                )}
              </NavLink>
              {active && visibleItems.length > 1 && (
                <div className="sidebar-subnav">
                  {visibleItems.map((item) => (
                    <NavLink
                      aria-current={isNavigationItemActive(pathname, item, hash) ? 'page' : undefined}
                      className={`nav-subitem${isNavigationItemActive(pathname, item, hash) ? ' active' : ''}`}
                      key={item.to}
                      to={item.to}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <button className="sidebar-toggle" onClick={onHide} type="button">
        <AppIcon name="chevronsLeft" />
        <span>Hide Sidebar</span>
      </button>
    </aside>
  );
}
