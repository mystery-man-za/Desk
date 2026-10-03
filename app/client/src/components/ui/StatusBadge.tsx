import type { ReactNode } from 'react';

export type StatusTone = 'draft' | 'submitted' | 'cancelled' | 'neutral' | 'success' | 'warning';

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}
