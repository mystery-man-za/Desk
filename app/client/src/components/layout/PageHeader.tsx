import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
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
  const location = useLocation();
  const { pathname } = location;
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const historyRef = useRef({ keys: [location.key], index: 0 });
  const [historyAvailability, setHistoryAvailability] = useState({
    back: false,
    forward: false,
  });
  const title = titles[pathname] ?? 'Books';

  useEffect(() => {
    const history = historyRef.current;
    if (navigationType === 'PUSH') {
      const keys = history.keys.slice(0, history.index + 1);
      keys.push(location.key);
      history.keys = keys;
      history.index = keys.length - 1;
    } else if (navigationType === 'REPLACE') {
      history.keys[history.index] = location.key;
    } else {
      const index = history.keys.indexOf(location.key);
      if (index < 0) {
        history.keys = [location.key];
        history.index = 0;
      } else {
        history.index = index;
      }
    }
    setHistoryAvailability({
      back: history.index > 0,
      forward: history.index < history.keys.length - 1,
    });
  }, [location.key, navigationType]);

  return (
    <header className="topbar">
      <div className="page-header-left">
        <button
          aria-label="Menu"
          aria-haspopup="dialog"
          className="icon-button mobile-menu-trigger"
          onClick={onOpenMobileMenu}
          type="button"
        >
          <AppIcon name="panelLeft" size={18} />
          <span>Menu</span>
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
        <div className="desktop-header-navigation">
          <Link aria-label="Search" className="icon-button" title="Search" to="/search">
            <AppIcon name="search" size={16} />
          </Link>
          <button
            aria-label="Back"
            className="icon-button"
            disabled={!historyAvailability.back}
            onClick={() => navigate(-1)}
            title="Back"
            type="button"
          >
            <AppIcon name="back" size={16} />
          </button>
          <button
            aria-label="Forward"
            className="icon-button"
            disabled={!historyAvailability.forward}
            onClick={() => navigate(1)}
            title="Forward"
            type="button"
          >
            <AppIcon name="chevron" size={16} />
          </button>
        </div>
        <h1 className="page-header-title">{title}</h1>
      </div>
      <h1 className="mobile-page-title">{title}</h1>
    </header>
  );
}
