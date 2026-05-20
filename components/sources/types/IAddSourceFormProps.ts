import type { ISourceConfig } from '@/lib/storage/types/ISourceConfig';

export interface IAddSourceFormProps {
  onAdd: (configs: ISourceConfig[]) => Promise<void>;
  onCancel: () => void;
}
