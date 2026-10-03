import type { ReactNode } from 'react';
import { AppIcon, type AppIconName } from './AppIcon';

export function EmptyState({
  icon,
  title,
  detail,
  action,
  compact = false,
}: {
  icon?: AppIconName;
  title: string;
  detail?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`feature-empty-state${compact ? ' compact-empty-state' : ''}`}>
      {icon && (
        <span className="empty-icon">
          <AppIcon name={icon} size={20} />
        </span>
      )}
      <strong>{title}</strong>
      {detail && <p>{detail}</p>}
      {action}
    </div>
  );
}
