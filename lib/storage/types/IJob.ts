import { z } from 'zod';

import { EJobStatus } from './EJobStatus';
import { EPipelineStatus } from './EPipelineStatus';
import { EScreenStage } from './EScreenStage';
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
  /** ISO 639-3 language code detected from the posting text at ingest.
   *  Three letters (e.g., 'eng', 'spa', 'fra'). Undefined when detection
   *  was inconclusive, typically because there wasn't enough text. */
  language: z.string().length(3).optional(),
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
  // Screening cascade, system-driven. The raw `embedding` blob is held
  // server-side only and not exposed on this client-facing type. All
  // optional: callers creating a fresh job leave them unset and the DB
  // default ('scraped') populates `pipelineStatus`; the rowToJob mapper
  // guarantees a value on read.
  embeddingScore: z.number().optional(),
  pipelineStatus: z.nativeEnum(EPipelineStatus).optional(),
  screenedOutBy: z.nativeEnum(EScreenStage).optional(),
  screenReason: z.string().optional(),
  priorityBumpedAt: z.number().int().optional(),
  livenessCheckedAt: z.number().int().optional(),
  /** Skills/tools/keywords extracted from the description; cached after first run. */
  desiredSkills: z.array(z.string()).optional(),
  /**
   * Candidate has marked this posting as not accepting cover letters. Hides the
   * cover-letter panel for this job and surfaces in the application history.
   */
  noCoverLetter: z.boolean().optional(),
  /**
   * Cached per-job ranking of the candidate's cv stories. `hash` covers
   * (job description + profile id + story content+ids), so any input change
   * invalidates the cache and triggers a re-rank. Items are ordered best-first.
   */
  storyRanking: z
    .object({
      hash: z.string(),
      items: z.array(
        z.object({
          storyId: z.string(),
          why: z.string(),
        }),
      ),
      rankedAt: z.number().int(),
    })
    .optional(),
});

export interface IJob extends z.infer<typeof JobSchema> {}
