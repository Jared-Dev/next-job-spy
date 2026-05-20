import { UsageStampSchema } from '@/lib/storage/types/IUsageStamp';
import { z } from 'zod';

export const RankResultItemSchema = z.object({
  id: z.string(),
  fitScore: z.number().min(0).max(100),
  fitNotes: z.string(),
});

export const RankResultSchema = z.object({
  results: z.array(RankResultItemSchema),
  usage: UsageStampSchema,
});

export interface IRankResultItem extends z.infer<typeof RankResultItemSchema> {}
export interface IRankResult extends z.infer<typeof RankResultSchema> {}
