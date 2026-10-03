import { useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { MobileNavigation } from './MobileNavigation';
import { PageHeader } from './PageHeader';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`app-shell books-shell${sidebarOpen ? '' : ' sidebar-hidden'}`}>
      <Sidebar open={sidebarOpen} onHide={() => setSidebarOpen(false)} />
      <main className="main-content">
        <PageHeader
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          sidebarOpen={sidebarOpen}
        />
        <div className="shell-scroll" ref={contentRef}>
          <Outlet />
        </div>
      </main>
      <MobileNavigation
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        scrollToTop={() => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
      />
    </div>
  );
}
