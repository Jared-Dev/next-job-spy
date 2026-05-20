import { z } from 'zod';

export const EducationEntrySchema = z.object({
  school: z.string(),
  degree: z.string().optional(),
  field: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

export interface IEducationEntry extends z.infer<typeof EducationEntrySchema> {}
