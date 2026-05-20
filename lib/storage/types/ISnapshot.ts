import { z } from 'zod';

import { ApplicationSchema } from './IApplication';
import { ArtifactSchema } from './IArtifact';
import { JobSchema } from './IJob';
import { ProfileSchema } from './IProfile';
import { SettingsSchema } from './ISettings';

export const SnapshotSchema = z.object({
  version: z.literal(1),
  exportedAt: z.number().int(),
  profile: ProfileSchema.optional(),
  settings: SettingsSchema.partial().optional(),
  jobs: z.array(JobSchema).default([]),
  applications: z.array(ApplicationSchema).default([]),
  artifacts: z.array(ArtifactSchema).default([]),
});

export interface ISnapshot extends z.infer<typeof SnapshotSchema> {}
