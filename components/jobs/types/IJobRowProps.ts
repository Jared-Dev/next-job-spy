import type { IJob } from '@/lib/storage/types/IJob';
import type { EScreenStage } from '@/lib/storage/types/EScreenStage';

export interface IJobRowProps {
  job: IJob;
  /**
   * True when the view-driven scorer currently has this row in flight
   * at Claude. Drives the shimmer treatment on the pipeline badge.
   */
  isScoring?: boolean;
  /** True when the local Web Worker is screening this row right now. */
  isLocalScreening?: boolean;
  /**
   * Set when the cascade just dropped this row at the given stage.
   * Renders a red "Dropped" pill and applies the `njs-row-exit`
   * keyframe; the row unmounts when the context-side timer removes
   * the id from `recentlyDroppedIds`.
   */
  droppedAtStage?: EScreenStage;
}
