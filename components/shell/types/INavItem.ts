import type { TablerIcon } from '@tabler/icons-react';

export interface INavItem {
  href: string;
  label: string;
  icon: TablerIcon;
  disabled?: boolean;
  hint?: string;
}
