'use server';

import { and, asc, count, desc, eq, inArray, ne } from 'drizzle-orm';

import {
  advanceState,
  INITIAL_AUTO_TUNE_STATE,
  type IAutoTuneState,
  type IVerdictPair,
} from '@/lib/screening/embedding/autoTune';
import { bytesToFloat32, embedText } from '@/lib/screening/embedding/embed';
import { cosine } from '@/lib/screening/embedding/cosine';
import { jobTextForEmbedding } from '@/lib/screening/embedding/jobText';
import { profileTextForEmbedding } from '@/lib/screening/embedding/profileText';
import { isUrlLive } from '@/lib/screening/liveness/check';
import type {
  ILocalScreenJob,
  ILocalScreenProfileSnapshot,
} from '@/lib/screening/local/types';
import { db, schema } from '@/lib/storage/local/sqlite/Database';
import { EAuditVerdict } from '@/lib/storage/types/EAuditVerdict';
import { EPipelineStatus } from '@/lib/storage/types/EPipelineStatus';
import { EScreenStage } from '@/lib/storage/types/EScreenStage';
import { ESettingKey } from '@/lib/storage/types/ESettingKey';

import { getProfileAction } from './profile';
import { getSettingsAction, saveSettingsAction } from './settings';

/* ------------------------------------------------------------------ *
 * Auto-tune state I/O. State lives in the settings table as a JSON
 * blob; read/write are wrapped here so the rest of the file does not
 * touch the storage layer for it.
 * ------------------------------------------------------------------ */

async function readAutoTuneState(): Promise<IAutoTuneState> {
  const row = db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, ESettingKey.ScreeningAutoTuneState))
    .get();
  if (!row?.value) return INITIAL_AUTO_TUNE_STATE;
  try {
    const parsed = JSON.parse(row.value) as Partial<IAutoTuneState>;
    return {
      verdictCount: parsed.verdictCount ?? 0,
      thresholdHistory: Array.isArray(parsed.thresholdHistory)
        ? parsed.thresholdHistory.filter((n): n is number => typeof n === 'number')
        : [],
      lastRecomputedAt: parsed.lastRecomputedAt ?? null,
      stabilityConfidence: parsed.stabilityConfidence ?? 0,
      sampleWeight: parsed.sampleWeight ?? 0,
      confidence: parsed.confidence ?? 0,
      lastBatchSize: parsed.lastBatchSize ?? 1,
    };
  } catch {
    return INITIAL_AUTO_TUNE_STATE;
  }
}

async function writeAutoTuneState(state: IAutoTuneState): Promise<void> {
  const value = JSON.stringify(state);
  const now = Math.floor(Date.now() / 1000);
  db.insert(schema.settings)
    .values({ key: ESettingKey.ScreeningAutoTuneState, value })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value, updatedAt: now },
    })
    .run();
}

async function deleteAutoTuneState(): Promise<void> {
  db.delete(schema.settings)
    .where(eq(schema.settings.key, ESettingKey.ScreeningAutoTuneState))
    .run();
}

/** Public read of the current state for the stats panel. */
export async function getAutoTuneStateAction(): Promise<IAutoTuneState> {
  return readAutoTuneState();
}

/**
 * Confidence boundary for "settled" mode. Mirrors the value the
 * stats panel uses (kept inline here because that file does not
 * import server-only code). When auto-tune is disabled, the gate is
 * always considered open.
 */
const AUTO_TUNE_SETTLED_CONFIDENCE = 0.9;

export interface IAutoTuneGate {
  autoTuneEnabled: boolean;
  /** True when Claude scoring may proceed (auto-tune off, OR
   *  auto-tune on AND confidence >= the settled threshold). */
  isSettled: boolean;
  /** Current combined confidence (mirrored for UI). */
  confidence: number;
}

/**
 * Cheap "may we send to Claude?" check. Polled by the client to
 * pause view-driven scoring and the score-now actions while the
 * cascade's embedding stage is still learning. We don't want to
 * burn Claude tokens on jobs that pass a not-yet-trusted cascade.
 */
export async function getAutoTuneGateAction(): Promise<IAutoTuneGate> {
  const settings = await getSettingsAction();
  if (settings.screeningAutoTuneEnabled !== true) {
    return { autoTuneEnabled: false, isSettled: true, confidence: 1 };
  }
  const state = await readAutoTuneState();
  return {
    autoTuneEnabled: true,
    isSettled: state.confidence >= AUTO_TUNE_SETTLED_CONFIDENCE,
    confidence: state.confidence,
  };
}

/**
 * Pull every (embedding_score, local_verdict) pair we have. The
 * source of truth is the job row itself: anything with both
 * embedding_score AND local_judged_at set is a labeled data point.
 */
async function getVerdictPairs(): Promise<IVerdictPair[]> {
  const rows = db
    .select({
      pipelineStatus: schema.job.pipelineStatus,
      screenedOutBy: schema.job.screenedOutBy,
      embeddingScore: schema.job.embeddingScore,
      localJudgedAt: schema.job.localJudgedAt,
    })
    .from(schema.job)
    .all();
  const pairs: IVerdictPair[] = [];
  for (const r of rows) {
    if (r.localJudgedAt == null) continue;
    if (typeof r.embeddingScore !== 'number') continue;
    const rejected =
      r.pipelineStatus === EPipelineStatus.ScreenedOut &&
      r.screenedOutBy === EScreenStage.Local;
    pairs.push({ score: r.embeddingScore, rejected });
  }
  return pairs;
}

/**
 * Recompute the threshold + batch size from all current verdict data
 * and persist. Called after every local verdict when auto-tune is on.
 *
 * Writes to TWO places: the auto-tune state blob (for UI display) and
 * the regular settings keys (so the cascade actually reads the new
 * threshold and batch size on its next tick).
 */
export async function runAutoTuneRecomputeAction(): Promise<void> {
  const settings = await getSettingsAction();
  if (settings.screeningAutoTuneEnabled !== true) return;

  const pairs = await getVerdictPairs();
  const prev = await readAutoTuneState();
  const now = Math.floor(Date.now() / 1000);
  const { next, newThreshold } = advanceState(
    prev,
    pairs,
    now,
    settings.screeningAutoTuneMinVerdicts,
  );

  await writeAutoTuneState(next);

  if (newThreshold !== null) {
    await saveSettingsAction({
      screeningEmbeddingThreshold: Number(newThreshold.toFixed(3)),
      screeningEmbeddingBatchSize: next.lastBatchSize,
    });
    const last3 = next.thresholdHistory
      .slice(-3)
      .map((t) => t.toFixed(3))
      .join(', ');
    console.log(
      `[njs:autotune] verdicts=${next.verdictCount} threshold=${newThreshold.toFixed(3)} confidence=${next.confidence.toFixed(2)} (stability=${next.stabilityConfidence.toFixed(2)}, sample=${next.sampleWeight.toFixed(2)}) batch=${next.lastBatchSize} (last 3: ${last3})`,
    );
  } else {
    console.log(
      `[njs:autotune] verdicts=${next.verdictCount} no reject data yet; threshold unchanged`,
    );
  }
}

const DRAIN_BATCH_SIZE = 25;

/**
 * Pick the pipeline status a freshly-scraped job should start in, given
 * which cascade stages the user has enabled. Centralizes the cascade
 * routing so ingest + post-toggle backfill can share one source of truth.
 */
function initialPipelineStatus(
  embeddingEnabled: boolean | undefined,
  localEnabled: boolean | undefined,
): EPipelineStatus {
  if (embeddingEnabled === undefined || localEnabled === undefined) {
    // User has not been through the first-visit gate yet. Leave jobs
    // parked in `scraped` until they make a choice.
    return EPipelineStatus.Scraped;
  }
  if (embeddingEnabled) return EPipelineStatus.EmbeddingQueued;
  if (localEnabled) return EPipelineStatus.LocalQueued;
  // Both stages disabled: go straight to "ready for view-triggered Claude".
  return EPipelineStatus.LocalDone;
}

export async function getInitialPipelineStatusAction(): Promise<EPipelineStatus> {
  const settings = await getSettingsAction();
  return initialPipelineStatus(
    settings.screeningEmbeddingEnabled,
    settings.screeningLocalEnabled,
  );
}

/**
 * Compute the profile embedding if absent. Returns `null` if there's no
 * profile yet or it has no textual content to embed. Idempotent: a
 * cached embedding short-circuits the recompute.
 */
export async function ensureProfileEmbeddingAction(): Promise<Float32Array | null> {
  const row = db
    .select()
    .from(schema.profile)
    .where(eq(schema.profile.id, 1))
    .get();
  if (row?.embedding) {
    return bytesToFloat32(row.embedding as Buffer);
  }

  const profile = await getProfileAction();
  if (!profile) return null;

  const text = profileTextForEmbedding(profile);
  if (!text.trim()) return null;

  const bytes = await embedText(text);
  db.update(schema.profile)
    .set({ embedding: Buffer.from(bytes) })
    .where(eq(schema.profile.id, 1))
    .run();
  return bytesToFloat32(bytes);
}

/**
 * Wipe the cached profile embedding so the next screening pass re-derives
 * it. Called after profile saves; we don't recompute eagerly here
 * because the save path shouldn't block on model loading.
 */
export async function invalidateProfileEmbeddingAction(): Promise<void> {
  db.update(schema.profile)
    .set({ embedding: null })
    .where(eq(schema.profile.id, 1))
    .run();
}

interface IDrainResult {
  embedded: number;
  passed: number;
  screenedOut: number;
  skipped: number;
  /**
   * Job ids that THIS drain dropped at the embedding stage. The UI
   * uses this to play an exit animation on those rows before the
   * refetch removes them from the list. Empty when the batch
   * doesn't drop anything (or returns early before scoring).
   */
  droppedIds: number[];
}

/**
 * Drain a batch of jobs through the embedding screen. Picks up jobs in
 * `scraped` (pre-gate, after the user enables embedding) or
 * `embedding_queued` state. Idempotent (safe to call repeatedly); only
 * processes jobs that still need processing.
 */
export async function drainEmbeddingQueueAction(
  limit?: number,
): Promise<IDrainResult> {
  const settings = await getSettingsAction();
  // When no explicit limit is passed, read the dynamic batch size
  // (auto-tune writes this; user-controlled when auto-tune is off).
  // Falls back to the constant if the setting is missing for any
  // reason so we never accidentally process zero jobs.
  const effectiveLimit =
    limit ?? settings.screeningEmbeddingBatchSize ?? DRAIN_BATCH_SIZE;

  // Backpressure: don't let embedding outpace local. If local_queued
  // already has more than a small buffer waiting, return early so
  // local can catch up. Keeps the cascade balanced and means each
  // batch's verdict gets fed back into auto-tune before the next
  // batch goes in.
  if (settings.screeningLocalEnabled === true) {
    const localBacklog =
      db
        .select({ value: count() })
        .from(schema.job)
        .where(eq(schema.job.pipelineStatus, EPipelineStatus.LocalQueued))
        .get()?.value ?? 0;
    // Allow at most ~2 batches' worth of work to be queued. At cold
    // start batch=1, that's 2; at firehose batch=25, that's 50.
    const maxBacklog = Math.max(4, effectiveLimit * 2);
    if (localBacklog >= maxBacklog) {
      console.log(
        `[njs:screening:embedding] backpressure: local_queued depth ${localBacklog} >= ${maxBacklog}; pausing embedding`,
      );
      return { embedded: 0, passed: 0, screenedOut: 0, skipped: 0, droppedIds: [] };
    }
  }

  // Toggle off → advance any queued jobs past the embedding stage in bulk
  // and exit. The next stage worker (or view-triggered scoring) takes over.
  if (settings.screeningEmbeddingEnabled === false) {
    const nextStatus = settings.screeningLocalEnabled
      ? EPipelineStatus.LocalQueued
      : EPipelineStatus.LocalDone;
    const result = db
      .update(schema.job)
      .set({ pipelineStatus: nextStatus })
      .where(
        inArray(schema.job.pipelineStatus, [
          EPipelineStatus.Scraped,
          EPipelineStatus.EmbeddingQueued,
        ]),
      )
      .run();
    if (result.changes > 0) {
      console.log(
        `[njs:screening:embedding] toggle off; bypassed ${result.changes} jobs to ${nextStatus}`,
      );
    }
    return { embedded: 0, passed: 0, screenedOut: 0, skipped: 0, droppedIds: [] };
  }

  if (settings.screeningEmbeddingEnabled === undefined) {
    // Pre-gate. Don't process. The user hasn't chosen yet.
    console.log(
      '[njs:screening:embedding] skipped: user has not been through the first-visit gate',
    );
    return { embedded: 0, passed: 0, screenedOut: 0, skipped: 0, droppedIds: [] };
  }

  const profileVec = await ensureProfileEmbeddingAction();
  if (!profileVec) {
    console.warn(
      '[njs:screening:embedding] skipped: no profile embedding (empty profile or no text)',
    );
    return { embedded: 0, passed: 0, screenedOut: 0, skipped: 0, droppedIds: [] };
  }

  const threshold = settings.screeningEmbeddingThreshold;
  const nextStatusOnPass = settings.screeningLocalEnabled
    ? EPipelineStatus.LocalQueued
    : EPipelineStatus.LocalDone;

  const queued = db
    .select()
    .from(schema.job)
    .where(
      inArray(schema.job.pipelineStatus, [
        EPipelineStatus.Scraped,
        EPipelineStatus.EmbeddingQueued,
      ]),
    )
    .orderBy(schema.job.priorityBumpedAt, schema.job.discoveredAt)
    .limit(effectiveLimit)
    .all();

  if (queued.length === 0) {
    return { embedded: 0, passed: 0, screenedOut: 0, skipped: 0, droppedIds: [] };
  }

  const drainStartedAt = Date.now();
  console.log(
    `[njs:screening:embedding] draining ${queued.length} jobs (threshold ${threshold.toFixed(2)}, batchSize ${effectiveLimit})`,
  );

  let embedded = 0;
  let passed = 0;
  let screenedOut = 0;
  let skipped = 0;
  const droppedIds: number[] = [];

  for (const row of queued) {
    try {
      if (!row.descriptionMd && !row.title) {
        skipped += 1;
        continue;
      }
      const text = jobTextForEmbedding({
        title: row.title,
        company: row.company,
        location: row.location ?? undefined,
        descriptionMd: row.descriptionMd ?? undefined,
      });
      const bytes = await embedText(text);
      const vec = bytesToFloat32(bytes);
      const score = cosine(profileVec, vec);
      const didPass = score >= threshold;

      db.update(schema.job)
        .set({
          embedding: Buffer.from(bytes),
          embeddingScore: score,
          pipelineStatus: didPass ? nextStatusOnPass : EPipelineStatus.ScreenedOut,
          screenedOutBy: didPass ? null : EScreenStage.Embedding,
          screenReason: didPass
            ? null
            : `Topical similarity ${score.toFixed(3)} below threshold ${threshold.toFixed(2)}`,
        })
        .where(eq(schema.job.id, row.id))
        .run();

      embedded += 1;
      if (didPass) {
        passed += 1;
      } else {
        screenedOut += 1;
        droppedIds.push(row.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown embedding error';
      console.error(
        `[njs:screening:embedding] job ${row.id} (${row.title}) failed:`,
        message,
      );
      db.update(schema.job)
        .set({
          pipelineStatus: EPipelineStatus.Error,
          screenReason: `Embedding stage failed: ${message}`,
        })
        .where(eq(schema.job.id, row.id))
        .run();
      skipped += 1;
    }
  }

  const elapsed = ((Date.now() - drainStartedAt) / 1000).toFixed(1);
  console.log(
    `[njs:screening:embedding] drained ${embedded} in ${elapsed}s (${passed} passed, ${screenedOut} dropped, ${skipped} skipped)`,
  );
  return { embedded, passed, screenedOut, skipped, droppedIds };
}

/**
 * Fire-and-forget kicker for the drain. Exposed so ingest can call it
 * without awaiting; the embedding pass shouldn't block the scrape
 * roundtrip. Errors are swallowed (logged) so the caller never sees them.
 */
export async function kickEmbeddingDrainAction(): Promise<void> {
  void drainEmbeddingQueueAction()
    .then((result) => {
      if (result.embedded > 0 || result.screenedOut > 0) {
        console.log(
          `[screening:embedding] embedded ${result.embedded}, passed ${result.passed}, screened out ${result.screenedOut}`,
        );
      }
    })
    .catch((err) => {
      console.error('[screening:embedding] drain failed', err);
    });
}

interface IEmbeddingStats {
  total: number;
  pending: number;
  embedded: number;
  passed: number;
  screenedOut: number;
}

export interface IUnscreenedCounts {
  /** Jobs in `scraped` or `embedding_queued` (waiting to be embedded). */
  embeddingPending: number;
  /** Jobs in `local_queued` (waiting for the browser worker). */
  localPending: number;
  /** Total of the above. */
  total: number;
}

/**
 * How many jobs are still upstream of `local_done` and not yet screened
 * out. Used by the /jobs backlog card to surface unprocessed jobs and
 * to gate the auto-scan on mount.
 */
export async function getUnscreenedCountsAction(): Promise<IUnscreenedCounts> {
  const rows = db
    .select({ pipelineStatus: schema.job.pipelineStatus })
    .from(schema.job)
    .all();
  let embeddingPending = 0;
  let localPending = 0;
  for (const r of rows) {
    const ps = r.pipelineStatus as EPipelineStatus;
    if (
      ps === EPipelineStatus.Scraped ||
      ps === EPipelineStatus.EmbeddingQueued
    ) {
      embeddingPending += 1;
    } else if (ps === EPipelineStatus.LocalQueued) {
      localPending += 1;
    }
  }
  return {
    embeddingPending,
    localPending,
    total: embeddingPending + localPending,
  };
}

export interface IBacklogScanResult {
  iterations: number;
  embedded: number;
  passed: number;
  screenedOut: number;
  skipped: number;
}

/**
 * Drain the embedding queue in a loop until empty or the iteration cap.
 * Used by the /jobs backlog card; the cap keeps a single Server Action
 * call bounded so it doesn't get killed by the request timeout. For a
 * very large backlog, the client just re-invokes after each completion.
 *
 * Each drainEmbeddingQueueAction call processes up to DRAIN_BATCH_SIZE
 * (25) jobs, so the default 40 iterations covers up to 1000 jobs per
 * call.
 */
export async function processBacklogAction(
  maxIterations: number = 40,
): Promise<IBacklogScanResult> {
  let embedded = 0;
  let passed = 0;
  let screenedOut = 0;
  let skipped = 0;
  let iterations = 0;
  const startedAt = Date.now();
  console.log(
    `[njs:screening:backlog] starting (max ${maxIterations} iterations)`,
  );
  for (let i = 0; i < maxIterations; i += 1) {
    iterations = i + 1;
    const result = await drainEmbeddingQueueAction();
    embedded += result.embedded;
    passed += result.passed;
    screenedOut += result.screenedOut;
    skipped += result.skipped;
    if (result.embedded === 0 && result.skipped === 0) break;
  }
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[njs:screening:backlog] done in ${elapsed}s after ${iterations} iterations: ${embedded} embedded (${passed} passed, ${screenedOut} dropped, ${skipped} skipped)`,
  );
  return { iterations, embedded, passed, screenedOut, skipped };
}

/* ------------------------------------------------------------------ *
 * Local LLM stage (Stage 3)
 *
 * The worker lives in the browser; these actions feed it from the
 * server-side queue and persist its verdicts. The worker pulls jobs
 * one at a time (it's slow), so these favor small focused payloads.
 * ------------------------------------------------------------------ */

/**
 * Lightweight profile snapshot for the local screening prompt. We send
 * only what the gate actually reasons over so the small model isn't
 * swamped by boilerplate.
 */
export async function getProfileSnapshotForScreeningAction(): Promise<ILocalScreenProfileSnapshot | null> {
  const profile = await getProfileAction();
  if (!profile) return null;
  return {
    headline: profile.headline,
    summary: profile.summary,
    skills: profile.skills?.map((s) => s.name).slice(0, 30),
    preferences: profile.preferences
      ? [
          profile.preferences.desiredLocations?.length
            ? `Locations: ${profile.preferences.desiredLocations.join(', ')}`
            : '',
          profile.preferences.remote ? `Remote: ${profile.preferences.remote}` : '',
          profile.preferences.minSalary
            ? `Minimum salary: ${profile.preferences.minSalary}${profile.preferences.currency ? ' ' + profile.preferences.currency : ''}`
            : '',
        ]
          .filter(Boolean)
          .join('. ') || undefined
      : undefined,
    lookingFor: profile.careerContext?.lookingFor,
    avoiding: profile.careerContext?.avoiding,
    goals: profile.careerContext?.goals,
  };
}

/**
 * Run the liveness probe against a single job's URL and update the DB.
 * Used opportunistically before sending old jobs to the local LLM:
 * skips compute on postings that have 404'd while they were sitting in
 * the queue.
 */
export async function checkAndUpdateLivenessAction(
  jobId: number,
): Promise<'live' | 'expired' | 'inconclusive'> {
  const row = db
    .select({ id: schema.job.id, url: schema.job.url })
    .from(schema.job)
    .where(eq(schema.job.id, jobId))
    .get();
  if (!row) return 'inconclusive';

  const result = await isUrlLive(row.url);
  const now = Math.floor(Date.now() / 1000);

  if (result === false) {
    db.update(schema.job)
      .set({
        pipelineStatus: EPipelineStatus.Expired,
        livenessCheckedAt: now,
      })
      .where(eq(schema.job.id, jobId))
      .run();
    return 'expired';
  }
  // Stamp the check time whether live or inconclusive; we use this to
  // avoid rechecking the same job on every queue tick.
  db.update(schema.job)
    .set({ livenessCheckedAt: now })
    .where(eq(schema.job.id, jobId))
    .run();
  return result === true ? 'live' : 'inconclusive';
}

/**
 * Fetch the next batch of jobs awaiting the local screen. Prioritizes
 * bumped jobs (most recently bumped first), then falls back to most
 * recently discovered. Jobs older than the liveness threshold get a
 * HEAD-request probe before being returned; dead ones get marked
 * expired and skipped over.
 */
export async function getNextLocalJobsAction(
  limit: number = 1,
  excludeIds: number[] = [],
): Promise<ILocalScreenJob[]> {
  const settings = await getSettingsAction();
  if (settings.screeningLocalEnabled !== true) {
    return [];
  }

  const livenessDays = settings.screeningLivenessDays;
  const now = Math.floor(Date.now() / 1000);
  const stalenessThreshold = now - livenessDays * 86400;

  // Over-fetch a multiple of the limit so we can skip past expired
  // candidates without an empty result. Skip ids the caller already
  // has in flight in other workers (parallelism > 1 case).
  const excludeSet = new Set(excludeIds);
  const candidates = db
    .select({
      id: schema.job.id,
      title: schema.job.title,
      company: schema.job.company,
      location: schema.job.location,
      descriptionMd: schema.job.descriptionMd,
      discoveredAt: schema.job.discoveredAt,
      livenessCheckedAt: schema.job.livenessCheckedAt,
    })
    .from(schema.job)
    .where(eq(schema.job.pipelineStatus, EPipelineStatus.LocalQueued))
    .orderBy(desc(schema.job.priorityBumpedAt), asc(schema.job.discoveredAt))
    .limit(Math.max(limit * 3, 10))
    .all()
    .filter((r) => !excludeSet.has(r.id));

  const live: ILocalScreenJob[] = [];
  for (const row of candidates) {
    if (live.length >= limit) break;

    const needsProbe =
      row.discoveredAt < stalenessThreshold && row.livenessCheckedAt == null;
    if (needsProbe) {
      const verdict = await checkAndUpdateLivenessAction(row.id);
      if (verdict === 'expired') continue;
    }

    live.push({
      id: row.id,
      title: row.title,
      company: row.company,
      location: row.location ?? undefined,
      descriptionMd: row.descriptionMd ?? undefined,
    });
  }
  return live;
}

/**
 * Persist a verdict from the local screen. Pass moves the job toward
 * Claude's view-driven queue; reject parks it as screened_out with
 * the reason the model gave.
 */
export async function applyLocalVerdictAction(
  jobId: number,
  verdict: 'pass' | 'reject',
  reason: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  console.log(
    `[njs:screening:local] job ${jobId} verdict=${verdict}${verdict === 'reject' && reason ? ` reason="${reason.slice(0, 100)}"` : ''}`,
  );
  if (verdict === 'pass') {
    db.update(schema.job)
      .set({
        pipelineStatus: EPipelineStatus.LocalDone,
        screenedOutBy: null,
        screenReason: null,
        localJudgedAt: now,
      })
      .where(eq(schema.job.id, jobId))
      .run();
  } else {
    db.update(schema.job)
      .set({
        pipelineStatus: EPipelineStatus.ScreenedOut,
        screenedOutBy: EScreenStage.Local,
        screenReason: reason || 'Local screen flagged this as a mismatch.',
        localJudgedAt: now,
      })
      .where(eq(schema.job.id, jobId))
      .run();
  }
  // Resolve any pending tiered audit on this job at the embedding stage.
  // The local LLM verdict translates directly:
  //   local pass   = embedding wrongly dropped the job  -> should_pass
  //   local reject = embedding correctly dropped the job -> correct
  const pending = db
    .select({ id: schema.screeningAudit.id })
    .from(schema.screeningAudit)
    .where(
      and(
        eq(schema.screeningAudit.jobId, jobId),
        eq(schema.screeningAudit.stage, EScreenStage.Embedding),
        eq(schema.screeningAudit.verdict, EAuditVerdict.Pending),
      ),
    )
    .all();
  if (pending.length > 0) {
    const auditVerdict =
      verdict === 'pass' ? EAuditVerdict.ShouldPass : EAuditVerdict.Correct;
    for (const row of pending) {
      db.update(schema.screeningAudit)
        .set({ verdict: auditVerdict, reviewedAt: now })
        .where(eq(schema.screeningAudit.id, row.id))
        .run();
    }
    console.log(
      `[njs:screening:audit] embedding audit resolved for job ${jobId}: ${auditVerdict}`,
    );
  }

  // Trigger auto-tune recompute. Errors here must not break verdict
  // persistence (the job update above already succeeded).
  try {
    await runAutoTuneRecomputeAction();
  } catch (err) {
    console.error('[njs:autotune] recompute failed:', err);
  }
}

/** Count of jobs still waiting for the local screen. */
export async function getLocalQueueDepthAction(): Promise<number> {
  const result = db
    .select({ value: count() })
    .from(schema.job)
    .where(eq(schema.job.pipelineStatus, EPipelineStatus.LocalQueued))
    .get();
  return result?.value ?? 0;
}

/**
 * Mark a local-stage error against a specific job (e.g. worker
 * exception). We park the job in `error` rather than rejecting it; the
 * audit UI can surface these for retry without confusing them with
 * deliberate rejections.
 */
export async function markLocalErrorAction(
  jobId: number,
  message: string,
): Promise<void> {
  db.update(schema.job)
    .set({
      pipelineStatus: EPipelineStatus.Error,
      screenReason: `Local stage failed: ${message.slice(0, 240)}`,
    })
    .where(eq(schema.job.id, jobId))
    .run();
}

/**
 * Re-queue a single job that we know failed because the WORKER was
 * dead, not because the job itself was bad. Called when the driver
 * has decided to kill a worker (GPU device lost, OOM, repeated
 * errors): we don't want those jobs orphaned in Error state when the
 * next healthy worker could process them. Resolves any pending audit
 * back to Pending so it picks up the retried verdict cleanly.
 */
export async function requeueLocalJobAction(jobId: number): Promise<void> {
  db.update(schema.job)
    .set({
      pipelineStatus: EPipelineStatus.LocalQueued,
      screenReason: null,
    })
    .where(eq(schema.job.id, jobId))
    .run();
}

/**
 * Bulk re-queue every job currently parked in Error state back into
 * LocalQueued. Lets the user recover from a wave of worker failures
 * (typically: too-high parallelism caused VRAM OOM, user drops
 * parallelism, then needs a way to retry the dropped jobs without
 * blowing away unrelated cascade state).
 */
export async function retryErroredJobsAction(): Promise<{ retried: number }> {
  const result = db
    .update(schema.job)
    .set({
      pipelineStatus: EPipelineStatus.LocalQueued,
      screenReason: null,
    })
    .where(eq(schema.job.pipelineStatus, EPipelineStatus.Error))
    .run();
  const retried = Number(result.changes);
  if (retried > 0) {
    console.log(`[njs:screening] requeued ${retried} errored jobs to local_queued`);
  }
  return { retried };
}

/** Count of jobs currently parked in Error state. Used by the
 *  dashboard to decide whether to render the retry button. */
export async function getErroredJobCountAction(): Promise<number> {
  const result = db
    .select({ value: count() })
    .from(schema.job)
    .where(eq(schema.job.pipelineStatus, EPipelineStatus.Error))
    .get();
  return result?.value ?? 0;
}

/* ------------------------------------------------------------------ *
 * Stats + audit
 *
 * Stats power the Settings panel's "is this cascade earning its
 * keep?" view. The audit is a deliberate false-negative sampler the
 * user runs every so often: we re-surface random rows the cascade
 * dropped and ask "should this have passed?"
 * ------------------------------------------------------------------ */

export interface IStageStats {
  /** Total jobs that reached or have passed through this stage. */
  reached: number;
  /**
   * Of `reached`, how many were ACTUALLY judged by this stage rather
   * than bypassed (toggled off when they came through) or skipped due
   * to an error. For the embedding stage this is rows with a non-null
   * embedding_score; for the local stage it is rows the worker
   * produced a verdict on.
   */
  actuallyProcessed: number;
  /** `reached - dropped`. The "kept" count regardless of whether processed or bypassed. */
  kept: number;
  /** Of those, how many were dropped here. */
  dropped: number;
  /**
   * `dropped / actuallyProcessed`. Uses actuallyProcessed so a stage
   * that was toggled off does not show 0% as a misleading "100% pass
   * rate" when the truth is "stage never ran".
   */
  filterRate: number;
  /** Audit verdicts for this stage. */
  audit: {
    total: number;
    correctlyFiltered: number;
    shouldHavePassed: number;
    borderline: number;
    /** shouldHavePassed / total, 0 if total == 0. */
    falseNegativeRate: number;
  };
}

export interface IScreeningStats {
  embedding: IStageStats & {
    /**
     * Mean cosine across jobs that actually got embedded. Helps the
     * user calibrate threshold: if avg is 0.7, threshold 0.3 makes
     * sense; if avg is 0.35, threshold 0.3 is too permissive.
     */
    avgScore: number | null;
    /** Jobs sitting in scraped / embedding_queued, awaiting this stage. */
    pending: number;
  };
  local: IStageStats & {
    /**
     * Jobs the local stage dropped that the embedding stage had
     * already passed (embedding_score >= threshold). The number that
     * justifies the local stage's existence: if it's near zero, the
     * local stage is doing nothing the embedding screen wasn't.
     */
    marginalDropped: number;
    /** Jobs in local_queued, awaiting the browser worker. */
    pending: number;
  };
  /** Scoring outcomes from Claude. */
  scored: {
    count: number;
    avgFitScore: number | null;
  };
  /** Postings the liveness check confirmed are no longer reachable. */
  expired: number;
  /** Suggested embedding threshold from audit data (null when insufficient). */
  suggestedEmbeddingThreshold: number | null;
  /** Live auto-tune state. Null when auto-tune is disabled. */
  autoTune: IAutoTuneState | null;
  /** Configured min verdicts before auto-tune can declare convergence. */
  autoTuneMinVerdicts: number;
}

export async function getScreeningStatsAction(): Promise<IScreeningStats> {
  const settings = await getSettingsAction();
  const currentThreshold = settings.screeningEmbeddingThreshold;

  const rows = db
    .select({
      pipelineStatus: schema.job.pipelineStatus,
      screenedOutBy: schema.job.screenedOutBy,
      embeddingScore: schema.job.embeddingScore,
      fitScore: schema.job.fitScore,
      localJudgedAt: schema.job.localJudgedAt,
    })
    .from(schema.job)
    .all();

  let embReached = 0;
  let embDropped = 0;
  let embActuallyEmbedded = 0;
  let embScoreSum = 0;
  let embPending = 0;
  let localReached = 0;
  let localDropped = 0;
  let localActuallyJudged = 0;
  let localMarginal = 0;
  let localPending = 0;
  let scoredCount = 0;
  let scoredSum = 0;
  let expired = 0;

  for (const r of rows) {
    const ps = r.pipelineStatus as EPipelineStatus;

    // Embedding-stage accounting. A job "reached" embedding if it has
    // moved past Scraped/EmbeddingQueued; "actuallyEmbedded" means it
    // got a real score, distinguishing real-pass from bypassed.
    if (
      ps === EPipelineStatus.Scraped ||
      ps === EPipelineStatus.EmbeddingQueued
    ) {
      embPending += 1;
    } else {
      embReached += 1;
      if (typeof r.embeddingScore === 'number') {
        embActuallyEmbedded += 1;
        embScoreSum += r.embeddingScore;
      }
    }
    if (
      ps === EPipelineStatus.ScreenedOut &&
      r.screenedOutBy === EScreenStage.Embedding
    ) {
      embDropped += 1;
    }

    // Local-stage accounting. A job "reached" local if it cleared
    // embedding; "actuallyJudged" uses the localJudgedAt timestamp
    // set by applyLocalVerdictAction (both pass and reject branches),
    // so passes are now counted instead of being indistinguishable
    // from bypassed-by-embedding-when-local-was-off.
    const clearedEmbedding =
      ps === EPipelineStatus.LocalQueued ||
      ps === EPipelineStatus.LocalDone ||
      ps === EPipelineStatus.ClaudeQueued ||
      ps === EPipelineStatus.Scored ||
      (ps === EPipelineStatus.ScreenedOut &&
        r.screenedOutBy === EScreenStage.Local);
    if (clearedEmbedding) localReached += 1;
    if (ps === EPipelineStatus.LocalQueued) localPending += 1;
    if (r.localJudgedAt != null) localActuallyJudged += 1;
    if (
      ps === EPipelineStatus.ScreenedOut &&
      r.screenedOutBy === EScreenStage.Local
    ) {
      localDropped += 1;
      // Marginal: would have passed embedding alone (score >= threshold).
      if (
        typeof r.embeddingScore === 'number' &&
        r.embeddingScore >= currentThreshold
      ) {
        localMarginal += 1;
      }
    }

    if (ps === EPipelineStatus.Scored && typeof r.fitScore === 'number') {
      scoredCount += 1;
      scoredSum += r.fitScore;
    }

    if (ps === EPipelineStatus.Expired) expired += 1;
  }

  // Audit aggregates. Pending rows are excluded from totals + rates;
  // they represent tiered audits in flight, not finished verdicts.
  const auditRows = db.select().from(schema.screeningAudit).all();
  const auditByStage: Record<
    EScreenStage,
    { total: number; correct: number; shouldPass: number; borderline: number }
  > = {
    [EScreenStage.Embedding]: { total: 0, correct: 0, shouldPass: 0, borderline: 0 },
    [EScreenStage.Local]: { total: 0, correct: 0, shouldPass: 0, borderline: 0 },
  };
  for (const a of auditRows) {
    const stage = a.stage as EScreenStage;
    const verdict = a.verdict as string;
    if (!auditByStage[stage]) continue;
    if (verdict === 'pending') continue;
    auditByStage[stage].total += 1;
    if (verdict === 'correct') auditByStage[stage].correct += 1;
    else if (verdict === 'should_pass') auditByStage[stage].shouldPass += 1;
    else if (verdict === 'borderline') auditByStage[stage].borderline += 1;
  }

  function rateOrZero(n: number, d: number): number {
    return d === 0 ? 0 : n / d;
  }

  const embAudit = auditByStage[EScreenStage.Embedding];
  const localAudit = auditByStage[EScreenStage.Local];

  // Threshold suggestion derived from audit data.
  //
  // Setup: each audit-row joins to a job that was dropped at the
  // embedding stage; we know the score it had when it was dropped
  // (below the threshold of the time) and Claude's verdict on whether
  // that drop was correct.
  //
  // We want a new threshold T such that:
  //  - Jobs Claude said "should have passed" have score >= T (we
  //    would now keep them).
  //  - Jobs Claude said "correct" still have score < T (we keep
  //    dropping them).
  //
  // Algorithm: take the 25th percentile of the should-pass scores.
  // Catches roughly the top 75% of audited misses without
  // over-correcting on the single lowest outlier (which the old
  // min-minus-margin approach did). If the resulting candidate would
  // bring known-bad jobs back in (any "correct" score is also above
  // the candidate), pull T up toward the boundary between the two
  // groups instead.
  let suggestedEmbeddingThreshold: number | null = null;
  if (embAudit.shouldPass >= 3) {
    const auditedRows = db
      .select({
        embeddingScore: schema.job.embeddingScore,
        verdict: schema.screeningAudit.verdict,
      })
      .from(schema.screeningAudit)
      .innerJoin(schema.job, eq(schema.screeningAudit.jobId, schema.job.id))
      .where(eq(schema.screeningAudit.stage, EScreenStage.Embedding))
      .all();
    const shouldPassScores: number[] = [];
    const correctScores: number[] = [];
    for (const r of auditedRows) {
      if (typeof r.embeddingScore !== 'number') continue;
      if (r.verdict === EAuditVerdict.ShouldPass) shouldPassScores.push(r.embeddingScore);
      else if (r.verdict === EAuditVerdict.Correct) correctScores.push(r.embeddingScore);
    }
    if (shouldPassScores.length >= 3) {
      const sorted = [...shouldPassScores].sort((a, b) => a - b);
      const idx = Math.floor(sorted.length * 0.25);
      let candidate = sorted[idx] - 0.02;
      // If the candidate would also let "correct" drops back in, raise
      // it to just above the highest correct score so we keep filtering
      // those out.
      if (correctScores.length > 0) {
        const maxCorrect = Math.max(...correctScores);
        if (candidate <= maxCorrect) {
          candidate = maxCorrect + 0.01;
        }
      }
      const clamped = Math.max(0.05, Math.min(0.95, candidate));
      if (Math.abs(clamped - currentThreshold) >= 0.02) {
        suggestedEmbeddingThreshold = Number(clamped.toFixed(2));
      }
    }
  }

  function stage(
    reached: number,
    actuallyProcessed: number,
    dropped: number,
    a: typeof embAudit,
  ): IStageStats {
    return {
      reached,
      actuallyProcessed,
      kept: reached - dropped,
      dropped,
      // Rate is against actually-processed so a bypassed stage does
      // not advertise itself as "100% pass rate" when it never ran.
      filterRate: rateOrZero(dropped, actuallyProcessed),
      audit: {
        total: a.total,
        correctlyFiltered: a.correct,
        shouldHavePassed: a.shouldPass,
        borderline: a.borderline,
        falseNegativeRate: rateOrZero(a.shouldPass, a.total),
      },
    };
  }

  return {
    embedding: {
      ...stage(embReached, embActuallyEmbedded, embDropped, embAudit),
      avgScore:
        embActuallyEmbedded === 0
          ? null
          : Number((embScoreSum / embActuallyEmbedded).toFixed(3)),
      pending: embPending,
    },
    local: {
      ...stage(localReached, localActuallyJudged, localDropped, localAudit),
      marginalDropped: localMarginal,
      pending: localPending,
    },
    scored: {
      count: scoredCount,
      avgFitScore: scoredCount === 0 ? null : Number((scoredSum / scoredCount).toFixed(1)),
    },
    expired,
    suggestedEmbeddingThreshold,
    autoTune:
      settings.screeningAutoTuneEnabled === true
        ? await readAutoTuneState()
        : null,
    autoTuneMinVerdicts: settings.screeningAutoTuneMinVerdicts,
  };
}

/**
 * Sample N random screened-out jobs at the given stage. Returns the
 * full row so the audit UI can show the user enough context to judge.
 */
export interface IAuditSampleJob {
  id: number;
  title: string;
  company: string;
  location?: string;
  descriptionMd?: string;
  embeddingScore?: number;
  screenReason?: string;
}

export async function getAuditSampleAction(
  stage: EScreenStage,
  limit: number = 10,
): Promise<IAuditSampleJob[]> {
  // SQLite RANDOM() ORDER BY for a uniform-ish random sample. Excludes
  // jobs that have already been audited at this stage so successive
  // audit passes show fresh samples.
  const alreadyAuditedIds = db
    .select({ jobId: schema.screeningAudit.jobId })
    .from(schema.screeningAudit)
    .where(eq(schema.screeningAudit.stage, stage))
    .all()
    .map((r) => r.jobId);

  // Filter by stage in JS (drizzle's filter chain stays simple) and
  // exclude already-audited jobs.
  const stageFiltered = db
    .select({
      id: schema.job.id,
      title: schema.job.title,
      company: schema.job.company,
      location: schema.job.location,
      descriptionMd: schema.job.descriptionMd,
      embeddingScore: schema.job.embeddingScore,
      screenReason: schema.job.screenReason,
      screenedOutBy: schema.job.screenedOutBy,
    })
    .from(schema.job)
    .where(eq(schema.job.pipelineStatus, EPipelineStatus.ScreenedOut))
    .all()
    .filter((r) => r.screenedOutBy === stage)
    .filter((r) => !alreadyAuditedIds.includes(r.id));

  // Fisher-Yates shuffle then take limit.
  for (let i = stageFiltered.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [stageFiltered[i], stageFiltered[j]] = [stageFiltered[j], stageFiltered[i]];
  }
  return stageFiltered.slice(0, limit).map((r) => ({
    id: r.id,
    title: r.title,
    company: r.company,
    location: r.location ?? undefined,
    descriptionMd: r.descriptionMd ?? undefined,
    embeddingScore: r.embeddingScore ?? undefined,
    screenReason: r.screenReason ?? undefined,
  }));
}

export async function recordAuditVerdictAction(
  jobId: number,
  stage: EScreenStage,
  verdict: 'correct' | 'should_pass' | 'borderline',
): Promise<void> {
  db.insert(schema.screeningAudit)
    .values({
      jobId,
      stage,
      verdict,
    })
    .run();
}

export interface ITieredAuditResult {
  promoted: number;
  /** Ids of the jobs we just promoted, so the modal can track only
   *  this batch's verdicts as they resolve (rather than the whole
   *  audit history). */
  promotedJobIds: number[];
  reason?: string;
}

/**
 * Tiered audit: promote a sample of embedding-dropped jobs back into
 * local_queued and write screening_audit rows with verdict=pending.
 * The next stage (local LLM) produces the actual verdicts; when its
 * worker processes each job, applyLocalVerdictAction resolves the
 * pending audit row based on the local verdict.
 *
 * "Embedding audited by local" is the cheaper sibling of the Claude
 * audit: free per-call, runs on the user's own GPU, so large samples
 * (50, 100, even 500) are practical at the cost of taking a while to
 * complete.
 */
export async function promoteEmbeddingDropsForLocalAuditAction(
  sampleSize: number,
): Promise<ITieredAuditResult> {
  const settings = await getSettingsAction();
  if (settings.screeningLocalEnabled !== true) {
    return {
      promoted: 0,
      promotedJobIds: [],
      reason:
        'The local screen is disabled. Enable it in Settings before auditing the embedding stage with the local LLM.',
    };
  }

  const profile = await getProfileAction();
  if (!profile) {
    return {
      promoted: 0,
      promotedJobIds: [],
      reason: 'Profile is empty. The local screen needs a profile to judge against.',
    };
  }

  // Sample candidates: embedding-dropped jobs that do NOT already
  // have an audit row (pending or resolved) at this stage.
  const alreadyAuditedIds = new Set(
    db
      .select({ jobId: schema.screeningAudit.jobId })
      .from(schema.screeningAudit)
      .where(eq(schema.screeningAudit.stage, EScreenStage.Embedding))
      .all()
      .map((r) => r.jobId),
  );

  const candidates = db
    .select({
      id: schema.job.id,
      screenedOutBy: schema.job.screenedOutBy,
    })
    .from(schema.job)
    .where(eq(schema.job.pipelineStatus, EPipelineStatus.ScreenedOut))
    .all()
    .filter(
      (r) =>
        r.screenedOutBy === EScreenStage.Embedding &&
        !alreadyAuditedIds.has(r.id),
    );

  if (candidates.length === 0) {
    return {
      promoted: 0,
      promotedJobIds: [],
      reason:
        'No embedding-dropped jobs available to audit (none dropped yet, or every drop has already been audited).',
    };
  }

  // Fisher-Yates shuffle for a uniform-ish random sample.
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const picked = candidates.slice(0, sampleSize);
  const now = Math.floor(Date.now() / 1000);

  // One transaction so we don't end up with audit rows whose jobs
  // never got promoted, or vice versa. Drizzle's transaction runs
  // synchronously and returns the callback's return value (unlike the
  // native better-sqlite3 transaction, which returns a callable).
  db.transaction((tx) => {
    for (const c of picked) {
      tx.insert(schema.screeningAudit)
        .values({
          jobId: c.id,
          stage: EScreenStage.Embedding,
          verdict: EAuditVerdict.Pending,
          reviewedAt: now,
        })
        .run();
      tx.update(schema.job)
        .set({
          pipelineStatus: EPipelineStatus.LocalQueued,
          screenedOutBy: null,
          screenReason: null,
        })
        .where(eq(schema.job.id, c.id))
        .run();
    }
  });

  console.log(
    `[njs:screening:audit] tiered audit: promoted ${picked.length} embedding drops to local_queued`,
  );

  return {
    promoted: picked.length,
    promotedJobIds: picked.map((c) => c.id),
  };
}

export interface IAuditBatchProgress {
  /** Total jobs in this batch. */
  total: number;
  /** Still waiting for the local LLM to verdict. */
  pending: number;
  /** Local said pass: embedding was wrong to drop. */
  shouldPass: number;
  /** Local said reject: both stages agree. */
  correct: number;
  /** Job errored during local screening (pipelineStatus = Error) and
   *  will never produce a verdict. Counted separately so the modal
   *  shows progress accurately instead of hanging at "1 pending"
   *  forever. */
  errored: number;
  /** Per-job rows the worker has finished, most recent first. */
  resolved: Array<{
    jobId: number;
    title: string;
    company: string;
    verdict: 'should_pass' | 'correct' | 'errored';
    reviewedAt: number;
    reason?: string;
  }>;
}

/**
 * Snapshot of audit progress for a specific batch of job ids. Used
 * by the embedding-audit modal to poll while the local worker chews
 * through the promoted sample.
 */
export async function getAuditBatchProgressAction(
  jobIds: number[],
  stage: EScreenStage = EScreenStage.Embedding,
): Promise<IAuditBatchProgress> {
  if (jobIds.length === 0) {
    return {
      total: 0,
      pending: 0,
      shouldPass: 0,
      correct: 0,
      errored: 0,
      resolved: [],
    };
  }
  // Audit rows joined with their job, plus pipeline state and the
  // job's screen_reason (which holds the error message when the
  // local stage failed). Jobs that errored during local processing
  // have a Pending audit row (applyLocalVerdictAction never ran on
  // them) but a job state of Error; we surface those as 'errored'
  // instead of leaving the pending count stuck.
  const rows = db
    .select({
      jobId: schema.screeningAudit.jobId,
      verdict: schema.screeningAudit.verdict,
      reviewedAt: schema.screeningAudit.reviewedAt,
      title: schema.job.title,
      company: schema.job.company,
      pipelineStatus: schema.job.pipelineStatus,
      screenReason: schema.job.screenReason,
    })
    .from(schema.screeningAudit)
    .innerJoin(schema.job, eq(schema.screeningAudit.jobId, schema.job.id))
    .where(
      and(
        eq(schema.screeningAudit.stage, stage),
        inArray(schema.screeningAudit.jobId, jobIds),
      ),
    )
    .all();
  let pending = 0;
  let shouldPass = 0;
  let correct = 0;
  let errored = 0;
  const resolved: IAuditBatchProgress['resolved'] = [];
  for (const r of rows) {
    if (r.verdict === EAuditVerdict.Pending) {
      // Job errored before producing a verdict: count as errored
      // (will never resolve), not pending.
      if (r.pipelineStatus === EPipelineStatus.Error) {
        errored += 1;
        resolved.push({
          jobId: r.jobId,
          title: r.title,
          company: r.company,
          verdict: 'errored',
          reviewedAt: r.reviewedAt,
          reason: r.screenReason ?? undefined,
        });
      } else {
        pending += 1;
      }
    } else if (r.verdict === EAuditVerdict.ShouldPass) {
      shouldPass += 1;
      resolved.push({
        jobId: r.jobId,
        title: r.title,
        company: r.company,
        verdict: 'should_pass',
        reviewedAt: r.reviewedAt,
      });
    } else if (r.verdict === EAuditVerdict.Correct) {
      correct += 1;
      resolved.push({
        jobId: r.jobId,
        title: r.title,
        company: r.company,
        verdict: 'correct',
        reviewedAt: r.reviewedAt,
      });
    }
  }
  resolved.sort((a, b) => b.reviewedAt - a.reviewedAt);
  return { total: jobIds.length, pending, shouldPass, correct, errored, resolved };
}

/** Count of pending tiered audits at the embedding stage (jobs the
 *  local LLM has not yet produced a verdict for). */
export async function getPendingEmbeddingAuditCountAction(): Promise<number> {
  const result = db
    .select({ value: count() })
    .from(schema.screeningAudit)
    .where(
      and(
        eq(schema.screeningAudit.stage, EScreenStage.Embedding),
        eq(schema.screeningAudit.verdict, EAuditVerdict.Pending),
      ),
    )
    .get();
  return result?.value ?? 0;
}

/**
 * Bump a job to the front of its current queue. Sets
 * priorityBumpedAt to now; workers ORDER BY priority_bumped_at DESC
 * already, so this is the only write needed for the bump to take
 * effect across all remaining cascade stages.
 *
 * The bump carries through subsequent stages as well: a job bumped
 * while in embedding_queued stays bumped when it moves to local_queued,
 * because we never clear priority_bumped_at.
 */
export async function bumpJobPriorityAction(jobId: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  db.update(schema.job)
    .set({ priorityBumpedAt: now })
    .where(eq(schema.job.id, jobId))
    .run();
}

/**
 * How many jobs sit ahead of this one in its current stage's queue.
 * Used by the row UI to render "Nth in line for X". Returns -1 when
 * the job is not currently in a queueable state.
 */
export async function getJobQueuePositionAction(jobId: number): Promise<number> {
  const row = db
    .select({
      pipelineStatus: schema.job.pipelineStatus,
      priorityBumpedAt: schema.job.priorityBumpedAt,
      discoveredAt: schema.job.discoveredAt,
    })
    .from(schema.job)
    .where(eq(schema.job.id, jobId))
    .get();
  if (!row) return -1;
  const ps = row.pipelineStatus as EPipelineStatus;
  if (
    ps !== EPipelineStatus.Scraped &&
    ps !== EPipelineStatus.EmbeddingQueued &&
    ps !== EPipelineStatus.LocalQueued
  ) {
    return -1;
  }

  // Same status, then "ahead" = more recent priority_bumped_at OR
  // (same priority bucket AND earlier discovered_at). Mirrors the
  // worker ORDER BY: priority_bumped_at DESC NULLS LAST, discovered_at.
  const candidates = db
    .select({
      id: schema.job.id,
      priorityBumpedAt: schema.job.priorityBumpedAt,
      discoveredAt: schema.job.discoveredAt,
    })
    .from(schema.job)
    .where(eq(schema.job.pipelineStatus, ps))
    .all();

  let ahead = 0;
  for (const c of candidates) {
    if (c.id === jobId) continue;
    const aPrio = c.priorityBumpedAt;
    const bPrio = row.priorityBumpedAt;
    if (aPrio != null && bPrio == null) {
      ahead += 1;
      continue;
    }
    if (aPrio == null && bPrio != null) continue;
    if (aPrio != null && bPrio != null) {
      if (aPrio > bPrio) ahead += 1;
      else if (aPrio === bPrio && c.discoveredAt < row.discoveredAt) ahead += 1;
      continue;
    }
    // Both null.
    if (c.discoveredAt < row.discoveredAt) ahead += 1;
  }
  return ahead;
}

/**
 * Wipe every non-Claude screening state from every job that has NOT
 * yet been scored by Claude. Resets pipeline_status to Scraped, drops
 * cached embeddings + scores, clears screened_out_by / screen_reason,
 * forgets liveness checks. Jobs Claude has scored (fitScore is set,
 * pipelineStatus is Scored) are left alone so the expensive stage's
 * results survive.
 *
 * The cascade will re-run on the reset rows the next time the local
 * screen driver's backlog auto-kick fires (or the user clicks the
 * "Scan now" button), so a single click here turns into the
 * embedding -> local -> ready-for-Claude flow on every existing
 * un-scored job.
 */
export async function resetNonClaudeScreeningAction(): Promise<{ reset: number }> {
  const settings = await getSettingsAction();
  const result = db
    .update(schema.job)
    .set({
      pipelineStatus: EPipelineStatus.Scraped,
      embedding: null,
      embeddingScore: null,
      screenedOutBy: null,
      screenReason: null,
      livenessCheckedAt: null,
      localJudgedAt: null,
    })
    .where(ne(schema.job.pipelineStatus, EPipelineStatus.Scored))
    .run();
  const reset = Number(result.changes);
  // Wipe auto-tune state: the verdict history reflects the old job
  // set, much of which is now back at scraped without local verdicts.
  // Resuming from old learning would bias future tuning.
  await deleteAutoTuneState();
  // Wipe audit table too: the verdicts reference embedding/local
  // decisions on jobs that have now been un-dropped and will be
  // re-cascaded. Keeping the rows would surface false-negative rates
  // based on judgments the cascade no longer stands behind.
  const auditDeleted = db.delete(schema.screeningAudit).run();
  console.log(
    `[njs:screening] cleared ${auditDeleted.changes} audit rows on reset`,
  );
  // Also reset the auto-tune-managed settings to cold-start values.
  // Otherwise the next drain reads the LAST auto-tuned threshold
  // (e.g. 0.626) and batch size (e.g. 25) from settings and keeps
  // operating as if learning never reset. Only do this when auto-tune
  // is enabled; a manually-tuned threshold should be preserved.
  if (settings.screeningAutoTuneEnabled === true) {
    await saveSettingsAction({
      screeningEmbeddingThreshold: 0,
      screeningEmbeddingBatchSize: 1,
    });
    console.log(
      `[njs:screening] reset ${reset} non-Claude-scored jobs to scraped (auto-tune state cleared; threshold -> 0, batch -> 1)`,
    );
  } else {
    console.log(
      `[njs:screening] reset ${reset} non-Claude-scored jobs to scraped (auto-tune off; threshold and batch left at user values)`,
    );
  }
  return { reset };
}

/**
 * Promote a screened-out job back into the cascade so it gets scored.
 * Used when an audit verdict marks the job "should have passed":
 * the cascade decision was wrong, so we feed it forward.
 */
export async function promoteScreenedOutJobAction(jobId: number): Promise<void> {
  db.update(schema.job)
    .set({
      pipelineStatus: EPipelineStatus.LocalDone,
      screenedOutBy: null,
      screenReason: null,
    })
    .where(eq(schema.job.id, jobId))
    .run();
}

export async function getEmbeddingStatsAction(): Promise<IEmbeddingStats> {
  const rows = db
    .select({ pipelineStatus: schema.job.pipelineStatus, screenedOutBy: schema.job.screenedOutBy })
    .from(schema.job)
    .all();
  const total = rows.length;
  let pending = 0;
  let embedded = 0;
  let passed = 0;
  let screenedOut = 0;
  for (const r of rows) {
    if (
      r.pipelineStatus === EPipelineStatus.Scraped ||
      r.pipelineStatus === EPipelineStatus.EmbeddingQueued
    ) {
      pending += 1;
    } else if (
      r.pipelineStatus === EPipelineStatus.ScreenedOut &&
      r.screenedOutBy === EScreenStage.Embedding
    ) {
      embedded += 1;
      screenedOut += 1;
    } else if (
      r.pipelineStatus !== EPipelineStatus.Scraped &&
      r.pipelineStatus !== EPipelineStatus.EmbeddingQueued
    ) {
      embedded += 1;
      passed += 1;
    }
  }
  return { total, pending, embedded, passed, screenedOut };
}
