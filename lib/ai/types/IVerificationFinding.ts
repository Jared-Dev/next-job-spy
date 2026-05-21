import { z } from 'zod';

/** One factual claim in generated content that the profile does not support. */
export const VerificationFindingSchema = z.object({
  /** The unsupported text, quoted from the generated content. */
  claim: z.string(),
  /** Brief reason the claim is not backed by the profile. */
  issue: z.string(),
});

export interface IVerificationFinding
  extends z.infer<typeof VerificationFindingSchema> {}
