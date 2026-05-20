import { z } from 'zod';

import { ProfileSchema } from '@/lib/storage/types/IProfile';

export const RankJobInputSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  description: z.string().optional(),
});

export const RankRequestSchema = z.object({
  profile: ProfileSchema,
  jobs: z.array(RankJobInputSchema).min(1).max(20),
  model: z.string().optional(),
});

export interface IRankRequest extends z.infer<typeof RankRequestSchema> {}
