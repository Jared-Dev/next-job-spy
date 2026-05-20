import { z } from 'zod';

export const UsageStampSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  cacheCreationInputTokens: z.number().int().nonnegative().default(0),
  cacheReadInputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative(),
  model: z.string(),
  costUsd: z.number().nonnegative(),
});

export interface IUsageStamp extends z.infer<typeof UsageStampSchema> {}
