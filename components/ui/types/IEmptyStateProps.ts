import type { TablerIcon } from '@tabler/icons-react';

import type { IEmptyStateAction } from './IEmptyStateAction';

export interface IEmptyStateProps {
  icon: TablerIcon;
  title: string;
  description?: string;
  primaryAction?: IEmptyStateAction;
  secondaryAction?: IEmptyStateAction;
}
