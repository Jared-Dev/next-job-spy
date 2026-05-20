import { htmlToMarkdown } from '@/lib/jobs/htmlToMarkdown';
import { inferCountry } from '@/lib/jobs/inferCountry';
import { EJobStatus } from '@/lib/storage/types/EJobStatus';
import { ESourceId } from '@/lib/storage/types/ESourceId';
import type { IJob } from '@/lib/storage/types/IJob';

import type { IRemoteOkJob } from './types/IRemoteOkJob';

export function normalizeRemoteOkJob(raw: IRemoteOkJob): IJob {
  return {
    source: ESourceId.RemoteOk,
    sourceId: String(raw.id ?? raw.slug ?? raw.url ?? ''),
    url: raw.url ?? raw.apply_url ?? '',
    title: raw.position ?? 'Untitled',
    company: raw.company ?? 'Unknown',
    location: raw.location ?? 'Remote',
    country: inferCountry(raw.location),
    remote: true,
    postedAt: raw.date ? Math.floor(new Date(raw.date).getTime() / 1000) : undefined,
    descriptionMd: raw.description ? htmlToMarkdown(raw.description) : undefined,
    raw,
    discoveredAt: Math.floor(Date.now() / 1000),
    status: EJobStatus.New,
  };
}

export function matchesQuery(raw: IRemoteOkJob, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  const haystack = [
    raw.position,
    raw.company,
    raw.location,
    ...(raw.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}
