import type { ISourceConfig } from '@/lib/storage/types/ISourceConfig';

export interface ISourceConfigRowProps {
  config: ISourceConfig;
  onRefresh: (config: ISourceConfig) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  busy: boolean;
}
