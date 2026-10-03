import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/auth/AuthContext';
import { useWorkspace } from '../../app/workspace/WorkspaceContext';
import { AppIcon } from '../ui/AppIcon';
import { AppSheet } from '../ui/AppSheet';
import { isNavigationItemActive, mobileTabs, navigationGroups } from './navigation';

export function MobileNavigation({
  open,
  onClose,
  scrollToTop,
}: {
  open: boolean;
  onClose: () => void;
  scrollToTop: () => void;
}) {
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { company } = useWorkspace();
  const activeGroup = navigationGroups.find((group) =>
    group.items.some(
      (item) =>
        (!item.roles || item.roles.includes(user?.role ?? '')) &&
        isNavigationItemActive(pathname, item, hash),
    ),
  );
  const [expandedGroup, setExpandedGroup] = useState(activeGroup?.label ?? '');
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setExpandedGroup(activeGroup?.label ?? '');
  }, [activeGroup?.label, open]);

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
    <>
      <nav aria-label="Quick navigation" className="mobile-tab-bar">
        {mobileTabs.map(({ to, label, icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          const currentPath = pathname === to;
          const contents = (
            <>
              <AppIcon name={icon} size={24} />
              <span>{label}</span>
            </>
          );

          if (currentPath) {
            return (
              <button
                aria-current={active ? 'page' : undefined}
                className="mobile-tab active"
                key={to}
                onClick={scrollToTop}
                type="button"
              >
                {contents}
              </button>
            );
          }

          return (
            <NavLink
              className={`mobile-tab${active ? ' active' : ''}`}
              end={to === '/dashboard'}
              key={to}
              to={to}
            >
              {contents}
            </NavLink>
          );
        })}
      </nav>

      <AppSheet
        className="navigation-sheet"
        onClose={onClose}
        open={open}
        title="Books"
      >
        <nav aria-label="Books navigation" className="sheet-nav-list">
          {signOutError && <div className="form-alert" role="alert">{signOutError}</div>}
          <div className="mobile-sheet-identity">
            <span className="brand-mark" aria-hidden="true">
              {(company?.name.slice(0, 1) ?? 'B').toUpperCase()}
            </span>
            <span>
              <strong>{company?.name ?? 'Books'}</strong>
              <small>{user?.fullname ?? user?.email ?? 'Workspace'}</small>
            </span>
          </div>
          <NavLink
            aria-current={pathname === '/dashboard' ? 'page' : undefined}
            className={`sheet-nav-item${pathname === '/dashboard' ? ' active' : ''}`}
            onClick={onClose}
            to="/dashboard"
          >
            <AppIcon name="dashboard" />
            <span>Dashboard</span>
          </NavLink>
          {navigationGroups.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.roles || item.roles.includes(user?.role ?? ''),
            );
            const expanded = expandedGroup === group.label;
            return (
              <div className="sheet-nav-group" key={group.label}>
                <button
                  aria-expanded={expanded}
                  className={`sheet-nav-item sheet-nav-group-heading${activeGroup?.label === group.label ? ' active' : ''}`}
                  onClick={() => {
                    setExpandedGroup(expanded ? '' : group.label);
                  }}
                  type="button"
                >
                  <AppIcon name={group.icon} />
                  <span>{group.label}</span>
                  <AppIcon
                    className={`nav-chevron${expanded ? ' expanded' : ''}`}
                    name="chevron"
                    size={16}
                  />
                </button>
                {expanded && visibleItems.length > 0 && (
                  <div className="sheet-nav-subitems">
                    {visibleItems.map((item) => {
                      const active = isNavigationItemActive(pathname, item, hash);
                      return (
                        <NavLink
                          aria-current={active ? 'page' : undefined}
                          className={`sheet-nav-subitem${active ? ' active' : ''}`}
                          key={item.to}
                          onClick={onClose}
                          to={item.to}
                        >
                          {item.label}
                          {active && <span className="nav-current-mark" />}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <button className="sheet-nav-item sheet-signout" onClick={() => void handleSignOut()} type="button">
            <AppIcon name="user" />
            <span>Sign out</span>
            <AppIcon name="chevron" size={16} />
          </button>
        </nav>
      </AppSheet>
    </>
  );
}
