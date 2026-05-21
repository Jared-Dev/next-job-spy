export enum EVerificationMode {
  /** Always fact-check with the stronger model. */
  Thorough = 'thorough',
  /** Fast model first; escalate to the stronger model when risk is detected. */
  Fast = 'fast',
}
