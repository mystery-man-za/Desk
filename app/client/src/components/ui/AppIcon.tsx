import {
  BookOpen,
  Building2,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  CreditCard,
  LayoutDashboard,
  ListFilter,
  ListTree,
  PanelLeft,
  Plus,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const icons = {
  dashboard: LayoutDashboard,
  building: Building2,
  accounts: ListTree,
  sales: CreditCard,
  expenses: CircleDollarSign,
  accounting: BookOpen,
  reports: ChartColumn,
  menu: PanelLeft,
  panelLeft: PanelLeft,
  close: X,
  chevron: ChevronRight,
  chevronDown: ChevronDown,
  chevronsLeft: ChevronsLeft,
  chevronsRight: ChevronsRight,
  search: Search,
  user: UserRound,
  plus: Plus,
  filter: ListFilter,
} satisfies Record<string, LucideIcon>;

export type AppIconName = keyof typeof icons;

export function AppIcon({
  name,
  size = 18,
  className,
}: {
  name: AppIconName;
  size?: number;
  className?: string;
}) {
  const Icon = icons[name];

  return (
    <Icon aria-hidden="true" className={className} size={size} strokeWidth={1.75} />
  );
}
