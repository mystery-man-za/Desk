import { useLocation } from 'react-router-dom';
import { useWorkspace } from '../../app/workspace/WorkspaceContext';
import { ApiStatus } from '../system/ApiStatus';
import { AppIcon } from '../ui/AppIcon';

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/accounts': 'Chart of accounts',
  '/settings/users': 'Manage users',
  '/sales': 'Sales',
  '/expenses': 'Expenses',
  '/accounting': 'Accounting',
  '/reports': 'Reports',
};

export function PageHeader({
  sidebarOpen,
  onToggleSidebar,
  onOpenMobileMenu,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenMobileMenu: () => void;
}) {
  const { pathname } = useLocation();
  const { company } = useWorkspace();
  const title = titles[pathname] ?? 'Books';

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <button
          aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          className="icon-button desktop-sidebar-toggle"
          onClick={onToggleSidebar}
          type="button"
        >
          <AppIcon name={sidebarOpen ? 'chevronsLeft' : 'chevronsRight'} />
        </button>
        <span>{company?.name ?? 'Workspace'}</span>
        <span aria-hidden="true">/</span>
        <strong>{title}</strong>
      </div>
      <div className="topbar-right">
        <span className="environment-tag">BOOKS</span>
        <ApiStatus />
        <button
          aria-label="Open navigation menu"
          className="icon-button mobile-menu-trigger"
          onClick={onOpenMobileMenu}
          type="button"
        >
          <AppIcon name="menu" />
        </button>
      </div>
    </header>
  );
}
