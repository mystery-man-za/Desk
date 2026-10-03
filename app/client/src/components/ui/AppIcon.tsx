import {
  Building2,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  LayoutDashboard,
  ListFilter,
  ListTree,
  NotebookTabs,
  PanelLeft,
  Plus,
  ChartNoAxesCombined,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const icons = {
  dashboard: LayoutDashboard,
  building: Building2,
  accounts: ListTree,
  sales: CreditCard,
  expenses: ShoppingBag,
  accounting: NotebookTabs,
  reports: ChartNoAxesCombined,
  setup: SlidersHorizontal,
  menu: PanelLeft,
  panelLeft: PanelLeft,
  close: X,
  back: ChevronLeft,
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
