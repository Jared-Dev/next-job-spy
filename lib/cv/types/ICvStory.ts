import { z } from 'zod';

/**
 * One clickbait-style filename candidate for a story. Multiple may be saved
 * per story; the candidate ticks which ones are eligible and the cover-letter
 * generator picks one at random per job application (so the same story can
 * surface under a different framing in different files).
 */
export const CvStoryFilenameOptionSchema = z.object({
  /** Filename text WITHOUT the ".pdf" extension. */
  text: z.string().min(1),
  /** When true, this option is in the random pool. */
  selected: z.boolean().default(true),
});

export interface ICvStoryFilenameOption
  extends z.infer<typeof CvStoryFilenameOptionSchema> {}

/**
 * A single saved story the cover-letter generator can pull from. Multiple are
 * allowed so the candidate can pick the most relevant one per job. Distilled
 * from the interview chat OR written by hand.
 */
export const CvStorySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  createdAt: z.number().int(),
  /** Where the story came from. `interview` for chat-distilled, `manual` for hand-authored. */
  source: z.enum(['interview', 'manual']).default('manual'),
  /** Clickbait filename candidates extracted (or hand-edited) for this story. */
  filenameOptions: z.array(CvStoryFilenameOptionSchema).optional(),
});

export interface ICvStory extends z.infer<typeof CvStorySchema> {}
