import { EJobStatus } from '@/lib/storage/types/EJobStatus';
import { ESourceId } from '@/lib/storage/types/ESourceId';
import type { IJob } from '@/lib/storage/types/IJob';

import { htmlToMarkdown } from '@/lib/jobs/htmlToMarkdown';
import { inferCountry } from '@/lib/jobs/inferCountry';

import type { IGreenhouseJob } from './types/IGreenhouseJob';

function inferRemote(locationName: string | undefined): boolean | undefined {
  if (!locationName) return undefined;
  return /remote/i.test(locationName);
}

export function normalizeGreenhouseJob(
  raw: IGreenhouseJob,
  boardSlug: string,
): IJob {
  const postedAt = raw.updated_at ? Math.floor(new Date(raw.updated_at).getTime() / 1000) : undefined;
  const locationName = raw.location?.name;
  return {
    source: ESourceId.Greenhouse,
    sourceId: String(raw.id),
    url: raw.absolute_url,
    title: raw.title,
    company: boardSlug,
    location: locationName,
    country: inferCountry(locationName),
    remote: inferRemote(locationName),
    postedAt,
    descriptionMd: raw.content ? htmlToMarkdown(raw.content) : undefined,
    raw,
    discoveredAt: Math.floor(Date.now() / 1000),
    status: EJobStatus.New,
  };
}
