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
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { company } = useWorkspace();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const activeGroup = navigationGroups.find((group) =>
    group.items.some((item) =>
      (!item.roles || item.roles.includes(user?.role ?? '')) &&
      isNavigationItemActive(pathname, item),
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
      <NavLink aria-label="Books workspace" className="brand" to="/dashboard">
        <span className="brand-mark" aria-hidden="true">
          {(company?.name.slice(0, 1) ?? 'B').toUpperCase()}
        </span>
        <span className="brand-copy">
          <strong>{company?.name ?? 'Books'}</strong>
          <small>Books workspace</small>
        </span>
      </NavLink>

      <div className="workspace-label">WORKSPACE</div>
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
                className={`nav-item sidebar-group-heading${active && visibleItems.length > 1 ? ' active' : ''}`}
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
                      aria-current={isNavigationItemActive(pathname, item) ? 'page' : undefined}
                      className={({ isActive }) =>
                        `nav-subitem${isActive || isNavigationItemActive(pathname, item) ? ' active' : ''}`
                      }
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
        <span>Hide sidebar</span>
      </button>

      <div className="sidebar-bottom">
        <div className="avatar" aria-hidden="true">
          {(user?.fullname.slice(0, 1) ?? 'B').toUpperCase()}
        </div>
        <div className="profile-copy">
          <strong>{user?.fullname ?? 'Your workspace'}</strong>
          <span>{user?.role}</span>
        </div>
        <button
          className="profile-menu sign-out-button"
          onClick={() => void handleSignOut()}
          type="button"
        >
          Sign out
        </button>
      </div>
      {signOutError && <div className="form-alert sidebar-alert" role="alert">{signOutError}</div>}
    </aside>
  );
}
