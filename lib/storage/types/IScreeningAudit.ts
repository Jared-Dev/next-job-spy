import { z } from 'zod';

import { EAuditVerdict } from './EAuditVerdict';
import { EScreenStage } from './EScreenStage';

/**
 * One row of the spot-check audit log: a job that was screened out at a
 * given stage, re-surfaced to the user, and their verdict on whether the
 * filter was right. Aggregated to produce false-negative rates per stage.
 */
export const ScreeningAuditSchema = z.object({
  id: z.number().int().optional(),
  jobId: z.number().int(),
  stage: z.nativeEnum(EScreenStage),
  verdict: z.nativeEnum(EAuditVerdict),
  reviewedAt: z.number().int(),
});

export interface IScreeningAudit extends z.infer<typeof ScreeningAuditSchema> {}
