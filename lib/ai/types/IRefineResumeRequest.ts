import { z } from 'zod';

import { ProfileSchema } from '@/lib/storage/types/IProfile';
import { ETemplateId } from '@/lib/storage/types/ETemplateId';

import { ERefineScope } from './ERefineScope';

export const RefineResumeRequestSchema = z.object({
  profile: ProfileSchema,
  job: z.object({
    title: z.string(),
    company: z.string(),
    location: z.string().optional(),
    description: z.string(),
  }),
  templateId: z.nativeEnum(ETemplateId),
  baseContent: z.string(),
  instruction: z.string().min(1).max(2000),
  scope: z.nativeEnum(ERefineScope).default(ERefineScope.Whole),
  sectionSnippet: z.string().optional(),
  model: z.string().optional(),
});

export interface IRefineResumeRequest extends z.infer<typeof RefineResumeRequestSchema> {}
