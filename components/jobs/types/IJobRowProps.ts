import type { IJob } from '@/lib/storage/types/IJob';

export interface IJobRowProps {
  job: IJob;
  /**
   * True when the view-driven scorer currently has this row in flight
   * at Claude. Drives the shimmer treatment on the pipeline badge.
   */
  isScoring?: boolean;
  /** True when the local Web Worker is screening this row right now. */
  isLocalScreening?: boolean;
}
