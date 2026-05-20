import { z } from 'zod';

import { UsageStampSchema } from '@/lib/storage/types/IUsageStamp';

export const GenerateResponseSchema = z.object({
  content: z.string(),
  usage: UsageStampSchema,
  templateId: z.string().optional(),
});

export interface IGenerateResponse extends z.infer<typeof GenerateResponseSchema> {}
