import type { ReactNode } from 'react';

export function PageContainer({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`dashboard page-container ${className}`}>{children}</section>;
}
