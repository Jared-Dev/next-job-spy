import { ESourceId } from '@/lib/storage/types/ESourceId';
import type { IJob } from '@/lib/storage/types/IJob';
import type { ISourceConfig } from '@/lib/storage/types/ISourceConfig';

import type { IJobSource } from '@/lib/jobs/types/IJobSource';

import { fetchGreenhouseBoard } from './fetch';
import { normalizeGreenhouseJob } from './normalize';

export const greenhouseSource: IJobSource = {
  id: ESourceId.Greenhouse,
  label: 'Greenhouse',
  description:
    'Public job boards hosted on Greenhouse. Pull jobs by board slug (e.g. anthropic, vercel).',
  paramFields: [
    {
      key: 'board',
      label: 'Board slug',
      placeholder: 'anthropic',
      required: true,
      description: 'The path segment from boards.greenhouse.io/<slug>',
      knownOptions: [
        { value: 'anthropic', label: 'Anthropic' },
        { value: 'vercel', label: 'Vercel' },
        { value: 'stripe', label: 'Stripe' },
        { value: 'openai', label: 'OpenAI' },
        { value: 'linear', label: 'Linear' },
        { value: 'figma', label: 'Figma' },
        { value: 'discord', label: 'Discord' },
        { value: 'airtable', label: 'Airtable' },
        { value: 'scaleai', label: 'Scale AI' },
        { value: 'ramp', label: 'Ramp' },
        { value: 'cloudflare', label: 'Cloudflare' },
        { value: 'duolingo', label: 'Duolingo' },
        { value: 'reddit', label: 'Reddit' },
        { value: 'robinhood', label: 'Robinhood' },
        { value: 'instacart', label: 'Instacart' },
        { value: 'doordash', label: 'DoorDash' },
        { value: 'asana', label: 'Asana' },
        { value: 'segment', label: 'Segment' },
        { value: 'plaid', label: 'Plaid' },
        { value: 'webflow', label: 'Webflow' },
      ],
    },
  ],
  async fetch(config: ISourceConfig): Promise<IJob[]> {
    const slug = config.params.board?.trim();
    if (!slug) throw new Error('Greenhouse source requires a "board" param.');
    const rawJobs = await fetchGreenhouseBoard(slug);
    return rawJobs.map((raw) => normalizeGreenhouseJob(raw, slug));
  },
};
