import { z } from 'zod';

import { SourceConfigSchema } from './ISourceConfig';

export const SettingsSchema = z.object({
  anthropicApiKey: z.string().optional(),
  aiModel: z.string().default('claude-sonnet-4-6'),
  aiMaxTokens: z.number().int().positive().max(200_000).default(8192),
  defaultTemplateId: z.string().optional(),
  sourceConfigs: z.array(SourceConfigSchema).default([]),
  /** 0 disables periodic auto-refresh. Otherwise the polling interval in minutes. */
  autoRefreshIntervalMin: z.number().int().nonnegative().max(1440).default(0),
  /** Unix seconds — last successful refresh-all timestamp. */
  lastRefreshAt: z.number().int().nonnegative().optional(),
});

export interface ISettings extends z.infer<typeof SettingsSchema> {}
