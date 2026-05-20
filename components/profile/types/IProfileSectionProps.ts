import type { TablerIcon } from '@tabler/icons-react';
import type { ReactNode } from 'react';

export interface IProfileSectionProps {
  title: string;
  description?: string;
  icon: TablerIcon;
  rightAction?: ReactNode;
  children: ReactNode;
}
