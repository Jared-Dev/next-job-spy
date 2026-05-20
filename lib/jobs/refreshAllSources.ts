'use client';

import { adapter } from '@/lib/storage';
import type { ISourceConfig } from '@/lib/storage/types/ISourceConfig';

import { ingestFromSource } from './ingest';
import type { IRefreshAllResult } from './types/IRefreshAllResult';

export async function refreshAllSources(
  configs: ISourceConfig[],
): Promise<IRefreshAllResult> {
  const enabled = configs.filter((c) => c.enabled);
  const enabledCount = enabled.length;
  if (enabledCount === 0) {
    return { enabledCount: 0, fetched: 0, inserted: 0, updated: 0, failures: 0 };
  }
  const results = await Promise.allSettled(enabled.map(ingestFromSource));
  let fetched = 0;
  let inserted = 0;
  let updated = 0;
  let failures = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      fetched += r.value.fetched;
      inserted += r.value.inserted;
      updated += r.value.updated;
    } else {
      failures += 1;
    }
  }
  await adapter.saveSettings({ lastRefreshAt: Math.floor(Date.now() / 1000) });
  return { enabledCount, fetched, inserted, updated, failures };
}
