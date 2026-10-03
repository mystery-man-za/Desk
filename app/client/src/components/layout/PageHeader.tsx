import { useLocation } from 'react-router-dom';
import { AppIcon } from '../ui/AppIcon';

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/accounts': 'Chart of accounts',
  '/settings/users': 'Manage users',
  '/sales': 'Sales',
  '/expenses': 'Expenses',
  '/accounting': 'Accounting',
  '/reports': 'Reports',
  '/search': 'Search',
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
  const title = titles[pathname] ?? 'Books';

  return (
    <header className="topbar">
      <div className="page-header-left">
        <button
          aria-label="Open navigation menu"
          aria-haspopup="dialog"
          className="icon-button mobile-menu-trigger"
          onClick={onOpenMobileMenu}
          type="button"
        >
          <AppIcon name="panelLeft" />
        </button>
        {!sidebarOpen && (
          <button
            aria-label="Show sidebar"
            className="icon-button desktop-sidebar-toggle"
            onClick={onToggleSidebar}
            type="button"
          >
            <AppIcon name="chevronsRight" />
          </button>
        )}
        <h1 className="page-header-title">{title}</h1>
      </div>
      <h1 className="mobile-page-title">{title}</h1>
    </header>
  );
}
