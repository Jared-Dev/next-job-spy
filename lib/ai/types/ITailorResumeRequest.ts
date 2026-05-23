import { z } from 'zod';

import { ProfileSchema } from '@/lib/storage/types/IProfile';
import { ETemplateId } from '@/lib/storage/types/ETemplateId';

export const TailorResumeRequestSchema = z.object({
  profile: ProfileSchema,
  job: z.object({
    title: z.string(),
    company: z.string(),
    location: z.string().optional(),
    description: z.string(),
  }),
  templateId: z.nativeEnum(ETemplateId),
  model: z.string().optional(),
  directive: z.string().optional(),
});

export interface ITailorResumeRequest extends z.infer<typeof TailorResumeRequestSchema> {}
