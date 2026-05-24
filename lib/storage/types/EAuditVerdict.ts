/**
 * The verdict on a sampled false-negative audit: was this job correctly
 * filtered out, or should it have passed?
 *
 * Pending is used by the tiered embedding audit: the row is queued for
 * the next-tier judge (local LLM) and the verdict resolves once that
 * stage produces a pass/reject for the job. Stats and threshold
 * suggestions ignore Pending rows.
 */
export enum EAuditVerdict {
  Pending = 'pending',
  Correct = 'correct',
  ShouldPass = 'should_pass',
  Borderline = 'borderline',
}
