import { z } from 'zod';

/**
 * One turn in the CV interview chat. Persisted on the profile so the
 * conversation is resumable across sessions.
 */
export const CvInterviewMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  /** Unix seconds. Sorting and "is this transcript active?" checks use this. */
  at: z.number().int(),
});

export interface ICvInterviewMessage
  extends z.infer<typeof CvInterviewMessageSchema> {}
