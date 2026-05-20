import { ESourceId } from '@/lib/storage/types/ESourceId';

import { greenhouseSource } from './sources/greenhouse';
import { leverSource } from './sources/lever';
import { remoteOkSource } from './sources/remoteok';
import { wwrSource } from './sources/wwr';
import type { IJobSource } from './types/IJobSource';

/**
 * Fetchable board sources. Manually-added jobs (ESourceId.Manual) have no
 * fetch adapter and deliberately do not appear here.
 */
export const JOB_SOURCES: Partial<Record<ESourceId, IJobSource>> = {
  [ESourceId.Greenhouse]: greenhouseSource,
  [ESourceId.Lever]: leverSource,
  [ESourceId.RemoteOk]: remoteOkSource,
  [ESourceId.WeWorkRemotely]: wwrSource,
};

export function getJobSource(id: ESourceId): IJobSource {
  const source = JOB_SOURCES[id];
  if (!source) {
    throw new Error(`No fetchable job source registered for "${id}"`);
  }
  return source;
}

export function listJobSources(): IJobSource[] {
  return Object.values(JOB_SOURCES).filter(
    (source): source is IJobSource => source !== undefined,
  );
}
