import type { ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
  accounts: <><path d="M4 5h16M4 10h16M4 15h10M4 20h10" /><circle cx="18" cy="17" r="3" /></>,
  sales: <><path d="M4 19V5m0 14h16" /><path d="m7 15 4-4 3 2 6-7" /><path d="M16 6h4v4" /></>,
  expenses: <><path d="M12 3v18M17 7.5c0-1.4-1.6-2.5-3.7-2.5S9.5 6.1 9.5 7.5 11 10 13.3 10s3.7 1.1 3.7 2.5-1.6 2.5-3.7 2.5-3.8-1.1-3.8-2.5" /></>,
  accounting: <><path d="M5 3h14v18H5z" /><path d="M8 7h8M8 11h8M8 15h3m2 0h3" /></>,
  reports: <><path d="M4 20V4m0 16h17" /><path d="M8 16v-4m5 4V7m5 9v-7" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  filter: <><path d="M4 6h16M7 12h10m-7 6h4" /></>,
};

export type AppIconName = keyof typeof paths;

export function AppIcon({
  name,
  size = 18,
}: {
  name: AppIconName;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  );
}
