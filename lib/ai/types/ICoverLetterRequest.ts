import { z } from 'zod';

import { ProfileSchema } from '@/lib/storage/types/IProfile';

export const CoverLetterRequestSchema = z.object({
  profile: ProfileSchema,
  job: z.object({
    title: z.string(),
    company: z.string(),
    location: z.string().optional(),
    description: z.string(),
  }),
  tailoredResume: z.string().optional(),
  model: z.string().optional(),
  directive: z.string().optional(),
});

export interface ICoverLetterRequest extends z.infer<typeof CoverLetterRequestSchema> {}
