import { z } from 'zod';

export const DistillProfileRequestSchema = z.object({
  markdown: z.string().min(20).max(200_000),
  model: z.string().optional(),
});

export interface IDistillProfileRequest
  extends z.infer<typeof DistillProfileRequestSchema> {}
