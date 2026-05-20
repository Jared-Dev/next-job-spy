import { ESourceId } from '@/lib/storage/types/ESourceId';
import type { IJob } from '@/lib/storage/types/IJob';
import type { ISourceConfig } from '@/lib/storage/types/ISourceConfig';

import type { IJobSource } from '@/lib/jobs/types/IJobSource';

import { fetchRemoteOk } from './fetch';
import { matchesQuery, normalizeRemoteOkJob } from './normalize';

export const remoteOkSource: IJobSource = {
  id: ESourceId.RemoteOk,
  label: 'RemoteOK',
  description: 'All remote roles aggregated by RemoteOK. Filter with a keyword query.',
  paramFields: [
    {
      key: 'query',
      label: 'Search query',
      placeholder: 'frontend, design systems, react',
      required: false,
      description:
        'Free-text match across title, company, location, and tags. Leave blank to ingest all remote jobs.',
      knownOptions: [
        { value: 'frontend', label: 'Frontend' },
        { value: 'backend', label: 'Backend' },
        { value: 'fullstack', label: 'Full-stack' },
        { value: 'design', label: 'Design' },
        { value: 'devops', label: 'DevOps' },
        { value: 'product', label: 'Product' },
        { value: 'ml', label: 'ML / AI' },
        { value: 'react', label: 'React' },
        { value: 'typescript', label: 'TypeScript' },
        { value: 'python', label: 'Python' },
        { value: 'rust', label: 'Rust' },
        { value: 'go', label: 'Go' },
      ],
    },
  ],
  async fetch(config: ISourceConfig): Promise<IJob[]> {
    const query = (config.params.query ?? '').trim();
    const all = await fetchRemoteOk();
    return all.filter((raw) => matchesQuery(raw, query)).map(normalizeRemoteOkJob);
  },
};
