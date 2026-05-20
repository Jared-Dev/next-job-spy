import type { ESourceId } from '@/lib/storage/types/ESourceId';
import type { IJob } from '@/lib/storage/types/IJob';
import type { ISourceConfig } from '@/lib/storage/types/ISourceConfig';

import type { IJobSourceParamField } from './IJobSourceParamField';

export interface IJobSource {
  id: ESourceId;
  label: string;
  description: string;
  paramFields: IJobSourceParamField[];
  fetch: (config: ISourceConfig) => Promise<IJob[]>;
}
