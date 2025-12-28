import { type ReactNode } from 'react';
import { Sidebar, type SidebarItem } from '../Sidebar';
import { Header } from '../Header';

export interface MainLayoutProps {
  children: ReactNode;
  sidebarItems: SidebarItem[];
  activePage: string;
  onPageChange: (page: string) => void;
  pageTitle?: string;
  headerActions?: ReactNode;
  sidebarHeader?: ReactNode;
  sidebarFooter?: ReactNode;
  sidebarCollapsed?: boolean;
}

export function MainLayout({
  children,
  sidebarItems,
  activePage,
  onPageChange,
  pageTitle,
  headerActions,
  sidebarHeader,
  sidebarFooter,
  sidebarCollapsed = false,
}: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-neutral-100 dark:bg-neutral-950">
      {/* Sidebar */}
      <Sidebar
        items={sidebarItems}
        activeKey={activePage}
        onSelect={onPageChange}
        header={sidebarHeader}
        footer={sidebarFooter}
        collapsed={sidebarCollapsed}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header title={pageTitle} actions={headerActions} />

        {/* Page Content */}
        <main className="flex-1 overflow-hidden bg-white dark:bg-neutral-900">
          {children}
        </main>
      </div>
    </div>
  );
}
