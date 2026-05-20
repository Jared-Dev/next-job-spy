import { ESourceId } from '@/lib/storage/types/ESourceId';
import type { IJob } from '@/lib/storage/types/IJob';
import type { ISourceConfig } from '@/lib/storage/types/ISourceConfig';

import type { IJobSource } from '@/lib/jobs/types/IJobSource';

import { fetchLeverCompany } from './fetch';
import { normalizeLeverJob } from './normalize';

export const leverSource: IJobSource = {
  id: ESourceId.Lever,
  label: 'Lever',
  description: 'Job postings on Lever-hosted career sites (jobs.lever.co/<company>).',
  paramFields: [
    {
      key: 'company',
      label: 'Company slug',
      placeholder: 'netflix',
      required: true,
      description: 'The path segment from jobs.lever.co/<company>',
      knownOptions: [
        { value: 'netflix', label: 'Netflix' },
        { value: 'github', label: 'GitHub' },
        { value: 'shopify', label: 'Shopify' },
        { value: 'brex', label: 'Brex' },
        { value: 'mistral', label: 'Mistral' },
        { value: 'palantir', label: 'Palantir' },
        { value: 'mercury', label: 'Mercury' },
        { value: 'rippling', label: 'Rippling' },
        { value: 'attentive', label: 'Attentive' },
        { value: 'gusto', label: 'Gusto' },
        { value: 'whoop', label: 'WHOOP' },
        { value: 'huggingface', label: 'Hugging Face' },
        { value: 'arc', label: 'The Browser Company (Arc)' },
        { value: 'retool', label: 'Retool' },
        { value: 'replit', label: 'Replit' },
      ],
    },
  ],
  async fetch(config: ISourceConfig): Promise<IJob[]> {
    const company = config.params.company?.trim();
    if (!company) throw new Error('Lever source requires a "company" param.');
    const rawJobs = await fetchLeverCompany(company);
    return rawJobs.map((raw) => normalizeLeverJob(raw, company));
  },
};
