import { z } from 'zod';

import { UsageStampSchema } from '@/lib/storage/types/IUsageStamp';

export const GenerateResponseSchema = z.object({
  content: z.string(),
  usage: UsageStampSchema,
  /**
   * Recommended save-as filename. Set by routes that produce a user-facing
   * file with a meaningful name (cover letters use a clickbait-style filename
   * the model generates); resumes use a standardized name and leave it empty.
   */
  filename: z.string().optional(),
});

export interface IGenerateResponse extends z.infer<typeof GenerateResponseSchema> {}
