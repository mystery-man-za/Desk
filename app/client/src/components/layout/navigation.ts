import type { AppIconName } from '../ui/AppIcon';

export type NavItem = {
  to: string;
  label: string;
  icon?: AppIconName;
  roles?: string[];
};

export type NavGroup = {
  label: string;
  icon: AppIconName;
  items: NavItem[];
};

export const navigationGroups: NavGroup[] = [
  {
    label: 'Sales',
    icon: 'sales',
    items: [
      { to: '/sales', label: 'Sales invoices' },
      { to: '/sales#customers', label: 'Customers' },
    ],
  },
  {
    label: 'Purchases',
    icon: 'expenses',
    items: [{ to: '/expenses', label: 'Expenses' }],
  },
  {
    label: 'Accounting',
    icon: 'accounting',
    items: [{ to: '/accounting', label: 'Journal entries' }],
  },
  {
    label: 'Reports',
    icon: 'reports',
    items: [{ to: '/reports', label: 'Financial reports' }],
  },
  {
    label: 'Setup',
    icon: 'accounts',
    items: [
      { to: '/accounts', label: 'Chart of accounts' },
      { to: '/settings/users', label: 'Manage users', roles: ['System Manager'] },
    ],
  },
];

export const mobileTabs = [
  { to: '/dashboard', label: 'Home', icon: 'dashboard' },
  { to: '/sales', label: 'Sales', icon: 'sales' },
  { to: '/expenses', label: 'Purchases', icon: 'expenses' },
  { to: '/reports', label: 'Reports', icon: 'reports' },
] as const;

export function isNavigationItemActive(pathname: string, item: NavItem): boolean {
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
