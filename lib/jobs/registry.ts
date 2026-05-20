import { ESourceId } from '@/lib/storage/types/ESourceId';

import { greenhouseSource } from './sources/greenhouse';
import { leverSource } from './sources/lever';
import { remoteOkSource } from './sources/remoteok';
import { wwrSource } from './sources/wwr';
import type { IJobSource } from './types/IJobSource';

export const JOB_SOURCES: Record<ESourceId, IJobSource> = {
  [ESourceId.Greenhouse]: greenhouseSource,
  [ESourceId.Lever]: leverSource,
  [ESourceId.RemoteOk]: remoteOkSource,
  [ESourceId.WeWorkRemotely]: wwrSource,
};

export function getJobSource(id: ESourceId): IJobSource {
  return JOB_SOURCES[id];
}

export function listJobSources(): IJobSource[] {
  return Object.values(JOB_SOURCES);
}
