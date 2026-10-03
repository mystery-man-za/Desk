import type { ReactNode } from 'react';

export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="welcome-row content-page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="welcome-copy">{description}</p>
      </div>
      {children && <div className="page-title-actions">{children}</div>}
    </header>
  );
}
