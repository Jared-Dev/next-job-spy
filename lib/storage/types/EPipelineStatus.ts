/**
 * Where a job sits in the screening cascade.
 *
 * Flow: `Scraped` → `EmbeddingQueued` → `EmbeddingDone` → `LocalQueued` →
 * `LocalDone` → `ClaudeQueued` → `Scored`. A job can exit early to
 * `ScreenedOut` (with `screenedOutBy` saying which stage) or `Expired`
 * (liveness check failed).
 *
 * Independent of the user-facing `EJobStatus` (new/saved/hidden/applied):
 * `pipelineStatus` is system-driven, `status` is user-driven.
 */
export enum EPipelineStatus {
  Scraped = 'scraped',
  EmbeddingQueued = 'embedding_queued',
  EmbeddingDone = 'embedding_done',
  LocalQueued = 'local_queued',
  LocalDone = 'local_done',
  ClaudeQueued = 'claude_queued',
  Scored = 'scored',
  ScreenedOut = 'screened_out',
  Expired = 'expired',
  Error = 'error',
}
