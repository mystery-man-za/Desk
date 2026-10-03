import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useWorkspace } from '../../app/workspace/WorkspaceContext';
import { ApiStatus } from '../system/ApiStatus';
import { MobileNavigation } from './MobileNavigation';
import { PageHeader } from './PageHeader';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const { company } = useWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className={`app-shell${sidebarOpen ? '' : ' sidebar-hidden'}`}>
      <Sidebar open={sidebarOpen} onHide={() => setSidebarOpen(false)} />
      <main className="main-content">
        <PageHeader
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          sidebarOpen={sidebarOpen}
        />
        <Outlet />
        <footer className="system-footer">
          <span>Books · {company?.name ?? 'Workspace'}</span>
          <ApiStatus />
        </footer>
      </main>
      <MobileNavigation
        onClose={() => setMobileMenuOpen(false)}
        onOpen={() => setMobileMenuOpen(true)}
        open={mobileMenuOpen}
      />
    </div>
  );
}
