import 'server-only';

/**
 * Pure auto-tune math. No DB, no settings: these functions take the
 * inputs and produce the outputs, so they're easy to reason about and
 * test independently of the wiring in screening.ts.
 *
 * The cascade calls runAutoTuneRecompute (the orchestrator that wraps
 * these in DB I/O) after every local verdict; the algorithm itself
 * lives here.
 */

const MAX_BATCH = 25;
const DELTA_TO_ZERO_CONFIDENCE = 0.1;
const HISTORY_CAP = 10;
/**
 * Default minimum verdict count before confidence can reach 1. The
 * user can override this via the screeningAutoTuneMinVerdicts
 * setting; we keep a default here so the algorithm has a sensible
 * fallback when called without one.
 *
 * Without this floor, a small sample whose 75th-percentile happens
 * to be stable for a few recomputes (e.g. 4 rejects: the algorithm
 * reads max(rejects) as threshold and that's locked in until a new
 * reject lands above it) would prematurely declare the firehose
 * open.
 */
export const DEFAULT_MIN_VERDICTS_FOR_FULL_CONFIDENCE = 100;
/**
 * Combined confidence above this value puts us in "settled" mode for
 * UI labelling. Below it, we are in "active learning" and the UI
 * shows what specifically is holding learning back.
 */
export const SETTLED_CONFIDENCE = 0.9;

export interface IVerdictPair {
  /** Embedding cosine score the job had when embedding judged it. */
  score: number;
  /** True when the local LLM later rejected the job. False when it passed. */
  rejected: boolean;
}

export interface IAutoTuneState {
  /** Total local verdicts observed (drives how much data the threshold
   *  is being fit from). */
  verdictCount: number;
  /** Last N recomputed thresholds; the freshest is at the end. */
  thresholdHistory: number[];
  /** Unix seconds when the most recent recompute ran. */
  lastRecomputedAt: number | null;
  /**
   * Threshold-stability portion of confidence in [0, 1]. 1 when the
   * last three recomputes barely moved; 0 when there is no history
   * yet or they whip around.
   */
  stabilityConfidence: number;
  /**
   * Sample-size weight in [0, 1]. Linear ramp from
   * 0 (verdictCount = 0) to 1 (verdictCount >= MIN_VERDICTS_FOR_FULL_CONFIDENCE).
   * Prevents the firehose from opening on a tiny sample whose
   * percentile-based threshold happens to be stable by coincidence.
   */
  sampleWeight: number;
  /**
   * Combined confidence: stabilityConfidence * sampleWeight. Drives
   * batch size; gate for "settled" vs "active learning" mode.
   */
  confidence: number;
  /** Most recent batch size suggestion, in [1, MAX_BATCH]. Mirrored
   *  for the UI so it does not have to recompute on render. */
  lastBatchSize: number;
}

export const INITIAL_AUTO_TUNE_STATE: IAutoTuneState = {
  verdictCount: 0,
  thresholdHistory: [],
  lastRecomputedAt: null,
  stabilityConfidence: 0,
  sampleWeight: 0,
  confidence: 0,
  lastBatchSize: 1,
};

/**
 * Max absolute gap between any two of the last three recomputed
 * thresholds. Returns null when there aren't three yet; caller
 * treats null as "confidence not measurable; stay at 0".
 */
export function computeMaxDeltaLast3(history: number[]): number | null {
  if (history.length < 3) return null;
  const last3 = history.slice(-3);
  const [a, b, c] = last3;
  return Math.max(Math.abs(b - a), Math.abs(c - b), Math.abs(c - a));
}

/**
 * Stability confidence in [0, 1]. 1 means the threshold has stopped
 * moving; 0 means it's whipping around or we don't have enough
 * history yet.
 *
 * Linear ramp from 0 (delta >= 0.1) to 1 (delta = 0). Picked the 0.1
 * upper bound because cosine threshold changes much smaller than that
 * still meaningfully shift filter rate; anything larger is "not
 * converged" by any reasonable measure.
 */
export function computeStabilityConfidence(history: number[]): number {
  const delta = computeMaxDeltaLast3(history);
  if (delta === null) return 0;
  const conf = 1 - delta / DELTA_TO_ZERO_CONFIDENCE;
  return Math.max(0, Math.min(1, conf));
}

/**
 * Sample-size weight in [0, 1]. Linear ramp from 0 (no verdicts) to
 * 1 (verdictCount >= minVerdicts). Prevents declaring the firehose
 * open on tiny samples even when threshold happens to look stable.
 */
export function computeSampleWeight(
  verdictCount: number,
  minVerdicts: number = DEFAULT_MIN_VERDICTS_FOR_FULL_CONFIDENCE,
): number {
  if (minVerdicts <= 0) return 1;
  return Math.max(0, Math.min(1, verdictCount / minVerdicts));
}

/**
 * Batch size scales linearly with confidence during learning. Once
 * confidence crosses SETTLED_CONFIDENCE we snap to MAX_BATCH so the
 * embedding stage runs at full throughput instead of plateauing at
 * round(MAX_BATCH * 0.9) = 22. Minimum 1 so we never stop sending
 * work to the embedding stage.
 */
export function computeBatchSize(confidence: number): number {
  if (confidence >= SETTLED_CONFIDENCE) return MAX_BATCH;
  return Math.max(1, Math.round(MAX_BATCH * confidence));
}

/**
 * Optimal threshold from verdict pairs.
 *
 * 75th percentile of REJECT scores: catches roughly the top 75% of
 * what local rejected, without overfitting to outliers in the bottom
 * tail.
 *
 * Clamped against the 25th percentile of PASS scores: if raising
 * threshold to the reject-p75 would also start dropping things local
 * said yes to, we cap it at where pass scores start, preserving
 * recall on the legitimate passes.
 *
 * Returns null when there are no reject scores yet; caller leaves
 * the threshold alone in that case.
 */
export function computeThreshold(pairs: IVerdictPair[]): number | null {
  const rejectScores: number[] = [];
  const passScores: number[] = [];
  for (const p of pairs) {
    if (p.rejected) rejectScores.push(p.score);
    else passScores.push(p.score);
  }
  if (rejectScores.length === 0) return null;

  rejectScores.sort((a, b) => a - b);
  passScores.sort((a, b) => a - b);

  const p75RejectIdx = Math.min(
    rejectScores.length - 1,
    Math.floor(rejectScores.length * 0.75),
  );
  const p75Reject = rejectScores[p75RejectIdx];

  if (passScores.length === 0) return clamp01(p75Reject);

  const p25PassIdx = Math.floor(passScores.length * 0.25);
  const p25Pass = passScores[p25PassIdx];

  return clamp01(Math.min(p75Reject, p25Pass));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Apply one verdict's worth of new data to the state. Pure: returns
 * the new state without side effects. Caller persists.
 */
export function advanceState(
  prev: IAutoTuneState,
  pairs: IVerdictPair[],
  now: number,
  minVerdicts: number = DEFAULT_MIN_VERDICTS_FOR_FULL_CONFIDENCE,
): { next: IAutoTuneState; newThreshold: number | null } {
  const newThreshold = computeThreshold(pairs);
  const verdictCount = pairs.length;
  const sampleWeight = computeSampleWeight(verdictCount, minVerdicts);

  if (newThreshold === null) {
    return {
      next: {
        ...prev,
        verdictCount,
        sampleWeight,
        lastRecomputedAt: now,
      },
      newThreshold: null,
    };
  }

  const thresholdHistory = [...prev.thresholdHistory, newThreshold].slice(
    -HISTORY_CAP,
  );
  const stabilityConfidence = computeStabilityConfidence(thresholdHistory);
  const confidence = stabilityConfidence * sampleWeight;
  const lastBatchSize = computeBatchSize(confidence);

  return {
    next: {
      verdictCount,
      thresholdHistory,
      lastRecomputedAt: now,
      stabilityConfidence,
      sampleWeight,
      confidence,
      lastBatchSize,
    },
    newThreshold,
  };
}
