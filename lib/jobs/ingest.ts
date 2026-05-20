'use client';

import { adapter } from '@/lib/storage';
import type { IJob } from '@/lib/storage/types/IJob';
import type { ISourceConfig } from '@/lib/storage/types/ISourceConfig';

export interface IIngestResult {
  fetched: number;
  inserted: number;
  updated: number;
}

export async function ingestFromSource(config: ISourceConfig): Promise<IIngestResult> {
  const res = await fetch(`/api/sources/${encodeURIComponent(config.sourceId)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || `Source returned ${res.status}`);
  }
  const data = (await res.json()) as { jobs: IJob[] };
  const fetched = data.jobs.length;
  if (fetched === 0) return { fetched: 0, inserted: 0, updated: 0 };
  const { inserted, updated } = await adapter.upsertJobs(data.jobs);
  return { fetched, inserted, updated };
}
