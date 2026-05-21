import { z } from 'zod';

import { EVerificationMode } from './EVerificationMode';
import { SourceConfigSchema } from './ISourceConfig';

export const SettingsSchema = z.object({
  anthropicApiKey: z.string().optional(),
  aiModel: z.string().default('claude-sonnet-4-6'),
  aiMaxTokens: z.number().int().positive().max(200_000).default(8192),
  defaultTemplateId: z.string().optional(),
  sourceConfigs: z.array(SourceConfigSchema).default([]),
  /** 0 disables periodic auto-refresh. Otherwise the polling interval in minutes. */
  autoRefreshIntervalMin: z.number().int().nonnegative().max(1440).default(0),
  /** When a job-URL import returns thin results, fall back to an AI extraction pass. */
  aiImportFallback: z.boolean().default(true),
  /** How thoroughly generated documents are fact-checked against the profile. */
  verificationMode: z
    .nativeEnum(EVerificationMode)
    .default(EVerificationMode.Thorough),
  /** Cross-check every number in generated content against the profile (zero-token). */
  crossCheckNumbers: z.boolean().default(true),
  /** Unix seconds — last successful refresh-all timestamp. */
  lastRefreshAt: z.number().int().nonnegative().optional(),
});

export interface ISettings extends z.infer<typeof SettingsSchema> {}
