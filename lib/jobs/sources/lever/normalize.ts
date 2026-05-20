import { htmlToMarkdown } from '@/lib/jobs/htmlToMarkdown';
import { inferCountry } from '@/lib/jobs/inferCountry';
import { EJobStatus } from '@/lib/storage/types/EJobStatus';
import { ESourceId } from '@/lib/storage/types/ESourceId';
import type { IJob } from '@/lib/storage/types/IJob';

import type { ILeverJob } from './types/ILeverJob';

function inferRemote(location: string | undefined): boolean | undefined {
  if (!location) return undefined;
  return /remote/i.test(location);
}

export function normalizeLeverJob(raw: ILeverJob, company: string): IJob {
  const location = raw.categories?.location ?? raw.categories?.allLocations?.[0];
  return {
    source: ESourceId.Lever,
    sourceId: raw.id,
    url: raw.hostedUrl,
    title: raw.text,
    company,
    location,
    country: inferCountry(location),
    remote: inferRemote(location),
    postedAt: raw.createdAt ? Math.floor(raw.createdAt / 1000) : undefined,
    descriptionMd: raw.description
      ? htmlToMarkdown(raw.description)
      : raw.descriptionPlain,
    raw,
    discoveredAt: Math.floor(Date.now() / 1000),
    status: EJobStatus.New,
  };
}
