import { z } from 'zod';

/** Job fields extracted from a posting URL, every field is best-effort. */
export const ImportedJobSchema = z.object({
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  descriptionMd: z.string().optional(),
});

export interface IImportedJob extends z.infer<typeof ImportedJobSchema> {}
