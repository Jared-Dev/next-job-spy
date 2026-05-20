import { z } from 'zod';

import { EApplicationStatus } from './EApplicationStatus';

export const ApplicationSchema = z.object({
  id: z.number().int().optional(),
  jobId: z.number().int(),
  status: z.nativeEnum(EApplicationStatus).default(EApplicationStatus.Drafting),
  submittedAt: z.number().int().optional(),
  notes: z.string().optional(),
  updatedAt: z.number().int(),
});

export interface IApplication extends z.infer<typeof ApplicationSchema> {}
