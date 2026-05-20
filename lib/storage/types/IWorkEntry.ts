import { z } from 'zod';

export const WorkEntrySchema = z.object({
  company: z.string().describe('Employer name'),
  title: z.string().describe('Job title held'),
  location: z.string().optional(),
  startDate: z.string().optional().describe('YYYY-MM if known, otherwise as written'),
  endDate: z.string().optional().describe('YYYY-MM, "Present", or as written'),
  current: z.boolean().optional(),
  summary: z.string().optional().describe('One-sentence role summary'),
  highlights: z
    .array(z.string())
    .optional()
    .describe('Bullet-point accomplishments, preserving the candidate voice'),
});

export interface IWorkEntry extends z.infer<typeof WorkEntrySchema> {}
