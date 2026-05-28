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
  /**
   * Which cover-letter path to use. `story` pulls from a saved story and
   * uses the story-driven prompt (the default once the candidate has at
   * least one story). `standard` runs the fallback prompt and explicitly
   * does NOT invent a story.
   */
  mode: z.enum(['story', 'standard']).default('story'),
  /** The picked story (required when mode is `story`). */
  story: z
    .object({
      title: z.string().min(1),
      content: z.string().min(1),
    })
    .optional(),
  /**
   * Pre-picked filename (without ".pdf",the route adds it). When provided,
   * we skip the model's filename generation entirely. The cover-letter panel
   * randomly picks one from the story's selected filenameOptions per
   * application and sends it here.
   */
  filenameOverride: z.string().optional(),
});

export interface ICoverLetterRequest extends z.infer<typeof CoverLetterRequestSchema> {}
