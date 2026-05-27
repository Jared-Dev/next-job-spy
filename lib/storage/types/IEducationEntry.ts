import { z } from 'zod';

export const EducationEntrySchema = z.object({
  school: z.string(),
  degree: z.string().optional(),
  field: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  /** The candidate's received GPA as a string (e.g. "3.62"). */
  gpa: z.string().optional(),
  /** The scale the GPA was measured against (e.g. "4.0"). */
  gpaScale: z.string().optional(),
  notes: z.string().optional(),
});

export interface IEducationEntry extends z.infer<typeof EducationEntrySchema> {}
