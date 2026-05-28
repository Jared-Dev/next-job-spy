import { z } from 'zod';

/**
 * Narrative career direction. Sharpens ranking (weight jobs against where the
 * candidate wants to go) and tailoring (frame the resume toward stated goals).
 * All free text, the Markdown importer fills these from the interview.
 */
export const CareerContextSchema = z.object({
  goals: z.string().optional(),
  lookingFor: z.string().optional(),
  avoiding: z.string().optional(),
  workingStyle: z.string().optional(),
});

export interface ICareerContext extends z.infer<typeof CareerContextSchema> {}
