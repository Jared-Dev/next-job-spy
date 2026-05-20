import { z } from 'zod';

import { EJobStatus } from './EJobStatus';
import { ESourceId } from './ESourceId';

export const JobSchema = z.object({
  id: z.number().int().optional(),
  source: z.nativeEnum(ESourceId),
  sourceId: z.string(),
  url: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  /** ISO 3166-1 alpha-2 country code, inferred at ingest from location. Undefined if ambiguous. */
  country: z.string().length(2).optional(),
  remote: z.boolean().optional(),
  salaryMin: z.number().int().optional(),
  salaryMax: z.number().int().optional(),
  salaryCurrency: z.string().optional(),
  postedAt: z.number().int().optional(),
  descriptionMd: z.string().optional(),
  raw: z.unknown().optional(),
  discoveredAt: z.number().int(),
  fitScore: z.number().min(0).max(100).optional(),
  fitNotes: z.string().optional(),
  status: z.nativeEnum(EJobStatus).default(EJobStatus.New),
});

export interface IJob extends z.infer<typeof JobSchema> {}
