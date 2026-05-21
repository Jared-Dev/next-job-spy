import type { IVerificationFinding } from './IVerificationFinding';

export interface IVerifyResult {
  /** Unsupported claims found. Empty means everything traces to the profile. */
  findings: IVerificationFinding[];
  /** True when a tiered check escalated to the stronger model. */
  escalated: boolean;
  /** Model id that produced the returned findings. */
  modelUsed: string;
}
