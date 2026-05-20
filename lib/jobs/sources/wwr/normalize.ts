import { htmlToMarkdown } from '@/lib/jobs/htmlToMarkdown';
import { inferCountry } from '@/lib/jobs/inferCountry';
import { EJobStatus } from '@/lib/storage/types/EJobStatus';
import { ESourceId } from '@/lib/storage/types/ESourceId';
import type { IJob } from '@/lib/storage/types/IJob';

import type { IWwrItem } from './types/IWwrItem';

/**
 * WWR titles follow the convention "Company Name: Job Title" most of the time.
 * Falls back to using the entire title as the job title if no colon is present.
 */
function splitCompanyAndTitle(rawTitle: string): { company: string; title: string } {
  const idx = rawTitle.indexOf(':');
  if (idx === -1) return { company: 'Unknown', title: rawTitle.trim() };
  return {
    company: rawTitle.slice(0, idx).trim(),
    title: rawTitle.slice(idx + 1).trim(),
  };
}

export function normalizeWwrItem(item: IWwrItem): IJob {
  const { company, title } = splitCompanyAndTitle(item.title);
  // WWR titles sometimes include country hints in the title body.
  const country = inferCountry(item.title) ?? inferCountry(item.description);
  return {
    source: ESourceId.WeWorkRemotely,
    sourceId: item.guid,
    url: item.link,
    title,
    company,
    location: 'Remote',
    country,
    remote: true,
    postedAt: item.pubDate ? Math.floor(new Date(item.pubDate).getTime() / 1000) : undefined,
    descriptionMd: item.description ? htmlToMarkdown(item.description) : undefined,
    raw: item,
    discoveredAt: Math.floor(Date.now() / 1000),
    status: EJobStatus.New,
  };
}
