'use client';

import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Paper,
  Progress,
  Stack,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCheck,
  IconCpu,
  IconDownload,
  IconCircleCheck,
  IconExclamationCircle,
  IconRadar2,
} from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { checkWebGpuCapability, type IGpuCheckResult } from '@/lib/screening/local/gpuCheck';
import { resolveLocalModel } from '@/lib/screening/local/modelMap';
import type {
  ILocalScreenJob,
  ILocalScreenProfileSnapshot,
  TWorkerInbound,
  TWorkerOutbound,
} from '@/lib/screening/local/types';
import { useAutoTuneGate } from '@/lib/screening/scoring/useAutoTuneGate';
import { useScreeningStatus } from '@/lib/screening/scoring/ScreeningStatusContext';
import { adapter } from '@/lib/storage';
import { ELocalModelVariant } from '@/lib/storage/types/ELocalModelVariant';
import { EScreenStage } from '@/lib/storage/types/EScreenStage';
import {
  applyLocalVerdictAction,
  drainEmbeddingQueueAction,
  getLocalQueueDepthAction,
  getNextLocalJobsAction,
  getProfileSnapshotForScreeningAction,
  getUnscreenedCountsAction,
  markLocalErrorAction,
  requeueLocalJobAction,
} from '@/lib/storage/local/actions/screening';
import { REFRESH_EVENTS, emitRefresh } from '@/lib/storage/local/refreshEvents';

/**
 * The local screen runs as N Web Workers on whichever tab has /jobs
 * open (N from the screeningLocalParallelism setting). This component:
 *
 *   - spawns N workers, each with its own WebLLM engine and model
 *     copy (so memory scales linearly with N. The heuristic in
 *     Settings tries to suggest a safe N for the user's hardware);
 *   - centrally tracks an in-flight Set of job ids so no two workers
 *     ever get the same job;
 *   - dispatches one job per idle worker on every ready/verdict/error
 *     transition;
 *   - rolls per-worker state up into one card for the UI.
 */
type TDriverState =
  | { phase: 'idle' }
  | { phase: 'checking_gpu' }
  | { phase: 'gpu_unavailable'; gpu: IGpuCheckResult }
  | { phase: 'no_profile' }
  | {
      phase: 'loading_model';
      text: string;
      progress: number;
      loaded: number;
      total: number;
    }
  | { phase: 'ready' }
  | { phase: 'screening'; activeCount: number }
  | { phase: 'error'; message: string };

type TWorkerPhase = 'loading' | 'ready' | 'screening' | 'error';

const QUEUE_REPOLL_MS = 10_000;
/**
 * Poll cadence for the embedding backlog scanner. Tighter when there's
 * a known large backlog so we don't wait 5s between scans while burning
 * down hundreds or thousands of jobs; relaxed once we're caught up.
 */
const BACKLOG_POLL_BUSY_MS = 1_000;
const BACKLOG_POLL_IDLE_MS = 5_000;
const BACKLOG_BUSY_THRESHOLD = 100;

/**
 * After this many back-to-back per-job errors, give up on a worker
 * slot. Catches "engine seemed to load but every chat call fails"
 * patterns (typically GPU OOM under parallelism or WebLLM compile
 * errors) so we don't fail every single queued job before the user
 * notices.
 */
const MAX_CONSECUTIVE_WORKER_ERRORS = 3;

/**
 * Error message fragments that mean the WebGPU device is gone for
 * this worker. No amount of retrying will help; the device is dead
 * and the only fix is a fresh worker. Match case-insensitively.
 */
const FATAL_WORKER_ERROR_PATTERNS = [
  'object has already been disposed',
  'device is lost',
  'device was lost',
  'gpu device lost',
  'out of memory',
  'oom',
] as const;

function isFatalWorkerError(message: string): boolean {
  const lower = message.toLowerCase();
  return FATAL_WORKER_ERROR_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Skip the per-row exit animation when a single tick drops more than
 * this many jobs (typically a fresh-import embedding pass burning down
 * the backlog). N simultaneous swipes feels noisy; we just refetch and
 * let the rows disappear. Single rejections still animate.
 */
const EXIT_ANIMATION_BATCH_BAIL = 5;

export function LocalScreenDriver() {
  const settings = adapter.useSettings();
  const { setCurrentLocalJobIds, markDropped } = useScreeningStatus();
  // The auto-tune gate gives us isSettled. While unsettled we want a
  // single worker: (a) batch_size=1 during learning means N-1 workers
  // are starved anyway; (b) more importantly, spawning N workers
  // simultaneously triggers a race in WebLLM/IndexedDB where some
  // workers' CreateMLCEngine resolves with a half-wired engine that
  // then fails every chat call with "Model not loaded". One worker
  // gets the model downloaded and cached cleanly; the rest can come
  // up afterwards reading from the same IDB cache.
  const autoTuneGate = useAutoTuneGate();
  // Normalised so the spawn effect's dep doesn't transition
  // undefined -> false when the first gate poll lands (which would
  // otherwise re-tear-down the worker mid model load).
  const gateIsSettled = autoTuneGate?.isSettled ?? false;
  const [state, setState] = useState<TDriverState>({ phase: 'idle' });
  const [queueDepth, setQueueDepth] = useState(0);
  const [processedThisSession, setProcessedThisSession] = useState(0);
  const [sessionStartDepth, setSessionStartDepth] = useState<number | null>(null);
  const [errorsThisSession, setErrorsThisSession] = useState(0);
  const [lastVerdictAt, setLastVerdictAt] = useState<number | null>(null);
  const [oldestJobStartedAt, setOldestJobStartedAt] = useState<number | null>(
    null,
  );
  const [unscreenedPending, setUnscreenedPending] = useState(0);
  const [scanning, setScanning] = useState(false);
  const scanningRef = useRef(false);

  // Per-worker imperative state. Parallel arrays indexed by worker
  // slot. All arrays are resized together when settings change.
  const workersRef = useRef<Array<Worker | null>>([]);
  const workerPhaseRef = useRef<TWorkerPhase[]>([]);
  const workerProgressRef = useRef<Array<{ text: string; progress: number } | null>>([]);
  const workerJobIdRef = useRef<Array<number | null>>([]);
  const workerJobStartedAtRef = useRef<Array<number | null>>([]);
  // Consecutive error counter per worker. If a worker fails N jobs in
  // a row we treat the engine as dead (typically: WebGPU device lost
  // under VRAM pressure, "Object disposed", or persistent compile
  // errors) and mark the slot 'error' instead of re-dispatching into
  // the same broken engine forever. Reset on every successful verdict.
  const workerConsecutiveErrorsRef = useRef<number[]>([]);

  // Shared in-flight set so the dispatcher never assigns the same job
  // to two workers. Also mirrored into the screening-status context
  // so row badges can shimmer when a worker is judging them.
  const inFlightIdsRef = useRef<Set<number>>(new Set());

  // Shared profile snapshot; re-fetched on demand if cleared.
  const profileRef = useRef<ILocalScreenProfileSnapshot | null>(null);

  // Re-poll timer for the case where every worker is ready but the
  // queue is empty; we want to wake up and check periodically.
  const repollHandleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Self-reference shim: dispatchToWorker schedules a re-poll that
  // calls dispatchToWorker again. Same pattern as the prior single-
  // worker driver: the ref is updated post-commit so the timer
  // closure picks up the latest version without the lint rule
  // complaining about pre-declaration access.
  const dispatchToWorkerRef = useRef<(idx: number) => Promise<void>>(
    async () => undefined,
  );

  // Promise-chain mutex serializing the "pick a job and claim it"
  // section of dispatchToWorker. Without it, N idle workers all read
  // inFlightIdsRef.current as empty at the same time and all get the
  // same job back from getNextLocalJobsAction. The chat call itself
  // still runs in parallel after the claim; only the SELECT+add is
  // serialized (microseconds).
  const dispatchLockRef = useRef<Promise<void>>(Promise.resolve());

  const publishInFlight = useCallback(() => {
    setCurrentLocalJobIds(new Set(inFlightIdsRef.current));
  }, [setCurrentLocalJobIds]);

  // Roll worker phases up into a single driver state for the UI.
  const recomputeAggregateState = useCallback(() => {
    const phases = workerPhaseRef.current;
    if (phases.length === 0) {
      setState({ phase: 'idle' });
      return;
    }
    const totalLoading = phases.filter((p) => p === 'loading').length;
    const totalReady = phases.filter((p) => p === 'ready').length;
    const totalScreening = phases.filter((p) => p === 'screening').length;
    const totalError = phases.filter((p) => p === 'error').length;

    if (totalError === phases.length) {
      setState({ phase: 'error', message: 'All local workers errored' });
      return;
    }
    if (totalLoading > 0) {
      // Show progress from the slowest-loading worker so the bar
      // reflects when ALL workers will be ready.
      const loadingProgresses = workerProgressRef.current
        .filter((p): p is { text: string; progress: number } => p !== null)
        .map((p) => p.progress);
      const minProgress =
        loadingProgresses.length > 0 ? Math.min(...loadingProgresses) : 0;
      const slowestText =
        workerProgressRef.current
          .filter((p): p is { text: string; progress: number } => p !== null)
          .sort((a, b) => a.progress - b.progress)[0]?.text ?? 'Loading...';
      const loadedCount = phases.length - totalLoading;
      setState({
        phase: 'loading_model',
        text: slowestText,
        progress: minProgress,
        loaded: loadedCount,
        total: phases.length,
      });
      return;
    }
    if (totalScreening > 0) {
      setState({ phase: 'screening', activeCount: totalScreening });
      // Track the oldest in-flight start so the diagnostics can flag
      // stalls based on whichever worker has been at it longest.
      const startedAts = workerJobStartedAtRef.current.filter(
        (t): t is number => t !== null,
      );
      setOldestJobStartedAt(startedAts.length > 0 ? Math.min(...startedAts) : null);
      return;
    }
    if (totalReady === phases.length) {
      setState({ phase: 'ready' });
      setOldestJobStartedAt(null);
      return;
    }
    // Mixed state (some ready, some errored, none working). Treat as
    // ready since at least one worker can still pick up jobs.
    setState({ phase: 'ready' });
    setOldestJobStartedAt(null);
  }, []);

  // Dispatch next job to a specific worker, if it's ready and there's
  // work to do.
  const dispatchToWorker = useCallback(
    async (idx: number) => {
      const worker = workersRef.current[idx];
      if (!worker) return;
      if (workerPhaseRef.current[idx] !== 'ready') return;

      // Claim a job under the shared lock so two workers can't pick
      // the same row. The lock only covers SELECT+claim; postMessage
      // happens outside so multiple workers still chat in parallel.
      type TClaim =
        | { kind: 'idle' }
        | { kind: 'no_profile' }
        | { kind: 'claimed'; job: ILocalScreenJob }
        | { kind: 'failed' };
      // Explicit cast keeps TS from narrowing to {kind: 'failed'} on
      // the initial assignment. The assignments inside the chained
      // .then are out of TS's flow-analysis reach.
      let claim = { kind: 'failed' } as TClaim;
      // .catch on the upstream link so a previous rejection doesn't
      // poison the whole chain. Inner try-catch keeps OUR link
      // resolved too, so dispatchLockRef.current always resolves.
      const claimP = dispatchLockRef.current
        .catch(() => undefined)
        .then(async (): Promise<void> => {
          try {
            // Re-check phase under the lock; another tick may have moved us.
            if (workerPhaseRef.current[idx] !== 'ready') {
              claim = { kind: 'failed' };
              return;
            }
            const excludes = Array.from(inFlightIdsRef.current);
            const jobs = await getNextLocalJobsAction(1, excludes);
            if (jobs.length === 0) {
              claim = { kind: 'idle' };
              return;
            }
            const job = jobs[0];
            let profile = profileRef.current;
            if (!profile) {
              profile = await getProfileSnapshotForScreeningAction();
              profileRef.current = profile;
            }
            if (!profile) {
              claim = { kind: 'no_profile' };
              return;
            }
            // Claim the job synchronously now that we have it. Anyone
            // entering the lock after us will see it in inFlightIdsRef
            // and skip past it.
            inFlightIdsRef.current.add(job.id);
            workerPhaseRef.current[idx] = 'screening';
            workerJobIdRef.current[idx] = job.id;
            workerJobStartedAtRef.current[idx] = Date.now();
            claim = { kind: 'claimed', job };
          } catch (err) {
            console.error('[njs:local-driver] dispatchToWorker claim failed', err);
            claim = { kind: 'failed' };
          }
        });
      dispatchLockRef.current = claimP;
      await claimP;

      if (claim.kind === 'idle') {
        // No work; re-poll periodically.
        if (repollHandleRef.current) clearTimeout(repollHandleRef.current);
        repollHandleRef.current = setTimeout(() => {
          repollHandleRef.current = null;
          // Try to dispatch to all idle workers on each repoll tick.
          for (let i = 0; i < workerPhaseRef.current.length; i += 1) {
            if (workerPhaseRef.current[i] === 'ready') {
              void dispatchToWorkerRef.current(i);
            }
          }
        }, QUEUE_REPOLL_MS);
        const depth = await getLocalQueueDepthAction();
        setQueueDepth(depth);
        recomputeAggregateState();
        return;
      }
      if (claim.kind === 'no_profile') {
        setState({ phase: 'no_profile' });
        return;
      }
      if (claim.kind === 'failed') {
        return;
      }

      publishInFlight();
      recomputeAggregateState();
      const msg: TWorkerInbound = {
        type: 'screen',
        job: claim.job,
        profile: profileRef.current!,
      };
      worker.postMessage(msg);
    },
    [publishInFlight, recomputeAggregateState],
  );

  // Keep the self-reference shim pointing at the latest dispatcher.
  useEffect(() => {
    dispatchToWorkerRef.current = dispatchToWorker;
  }, [dispatchToWorker]);

  // Build a message handler bound to a specific worker slot.
  const makeMessageHandler = useCallback(
    (idx: number) =>
      async (event: MessageEvent<TWorkerOutbound>) => {
        const msg = event.data;
        console.log('[njs:local-driver]', `[w${idx}]`, msg.type, msg);
        switch (msg.type) {
          case 'progress':
            workerProgressRef.current[idx] = {
              text: msg.text,
              progress: msg.progress,
            };
            workerPhaseRef.current[idx] = 'loading';
            recomputeAggregateState();
            break;
          case 'ready': {
            workerPhaseRef.current[idx] = 'ready';
            workerProgressRef.current[idx] = null;
            recomputeAggregateState();
            const depth = await getLocalQueueDepthAction();
            setQueueDepth(depth);
            setSessionStartDepth((prev) => (prev === null ? depth : prev));
            await dispatchToWorker(idx);
            break;
          }
          case 'verdict': {
            await applyLocalVerdictAction(msg.jobId, msg.verdict, msg.reason);
            // Mark the row as just-dropped BEFORE the refresh fires so
            // the list merge can keep the row mounted while the exit
            // animation plays. Single drops always animate (one row at
            // a time is not noisy).
            if (msg.verdict === 'reject') {
              markDropped(msg.jobId, EScreenStage.Local);
            }
            emitRefresh(REFRESH_EVENTS.Jobs);
            inFlightIdsRef.current.delete(msg.jobId);
            publishInFlight();
            workerPhaseRef.current[idx] = 'ready';
            workerJobIdRef.current[idx] = null;
            workerJobStartedAtRef.current[idx] = null;
            // A successful verdict clears the consecutive-error counter
            // so a transient blip doesn't permanently disable the worker.
            workerConsecutiveErrorsRef.current[idx] = 0;
            setProcessedThisSession((n) => n + 1);
            setLastVerdictAt(Date.now());
            const depth = await getLocalQueueDepthAction();
            setQueueDepth(depth);
            recomputeAggregateState();
            await dispatchToWorker(idx);
            break;
          }
          case 'error': {
            if (msg.jobId !== undefined) {
              const fatal = isFatalWorkerError(msg.message);
              const nextCount =
                (workerConsecutiveErrorsRef.current[idx] ?? 0) + 1;
              workerConsecutiveErrorsRef.current[idx] = nextCount;
              const willKillWorker =
                fatal || nextCount >= MAX_CONSECUTIVE_WORKER_ERRORS;

              // If this is a worker-fault error (we're killing the
              // worker because of it), re-queue the job so the next
              // healthy worker can take a swing at it. Otherwise it's
              // a per-job error: park in Error state.
              if (willKillWorker) {
                await requeueLocalJobAction(msg.jobId);
              } else {
                await markLocalErrorAction(msg.jobId, msg.message);
              }
              inFlightIdsRef.current.delete(msg.jobId);
              publishInFlight();
              setErrorsThisSession((n) => n + 1);
              workerJobIdRef.current[idx] = null;
              workerJobStartedAtRef.current[idx] = null;

              if (willKillWorker) {
                console.warn(
                  `[njs:local-driver] [w${idx}] marking worker dead:`,
                  fatal
                    ? `fatal pattern in "${msg.message}"`
                    : `${nextCount} consecutive errors`,
                );
                const w = workersRef.current[idx];
                if (w) {
                  try {
                    w.postMessage({ type: 'terminate' } satisfies TWorkerInbound);
                  } catch {
                    // Worker already gone.
                  }
                  w.terminate();
                  workersRef.current[idx] = null;
                }
                workerPhaseRef.current[idx] = 'error';
                recomputeAggregateState();
                break;
              }

              workerPhaseRef.current[idx] = 'ready';
              recomputeAggregateState();
              await dispatchToWorker(idx);
            } else {
              // Top-level worker error (engine init or fatal). This
              // worker is dead; the others can carry on.
              workerPhaseRef.current[idx] = 'error';
              workerJobIdRef.current[idx] = null;
              workerJobStartedAtRef.current[idx] = null;
              recomputeAggregateState();
            }
            break;
          }
        }
      },
    [dispatchToWorker, markDropped, publishInFlight, recomputeAggregateState],
  );

  // Lifecycle: spawn N workers when the user has the local screen
  // enabled, with the chosen variant and parallelism. Tear them down
  // when any of those settings change so we always have a fresh set.
  useEffect(() => {
    if (!settings) return;

    if (settings.screeningLocalEnabled !== true) {
      // Toggle is off (or pre-gate). Tear down anything running.
      for (const w of workersRef.current) {
        if (w) w.terminate();
      }
      workersRef.current = [];
      workerPhaseRef.current = [];
      workerProgressRef.current = [];
      workerJobIdRef.current = [];
      workerJobStartedAtRef.current = [];
      inFlightIdsRef.current.clear();
      publishInFlight();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ phase: 'idle' });
      return;
    }

    let cancelled = false;
    setState({ phase: 'checking_gpu' });

    void (async () => {
      const gpu = await checkWebGpuCapability();
      if (cancelled) return;
      if (gpu.status === 'unsupported_browser' || gpu.status === 'no_adapter') {
        setState({ phase: 'gpu_unavailable', gpu });
        return;
      }

      const variant =
        settings.screeningLocalModelVariant ?? ELocalModelVariant.Stronger;
      const modelInfo = resolveLocalModel(variant);
      const userParallelism = Math.max(
        1,
        Math.min(4, settings.screeningLocalParallelism ?? 1),
      );
      // During learning (or while the first gate fetch is still in
      // flight, gate === null) force a single worker: avoids both the
      // WebLLM init race and wasting memory on workers that the
      // batch_size=1 cascade would never feed. Once auto-tune settles
      // we redo this effect and bring the other workers up; by that
      // point the model is in IDB cache so their loads are fast.
      const parallelism = gateIsSettled ? userParallelism : 1;
      if (parallelism < userParallelism) {
        console.log(
          `[njs:local-driver] auto-tune not settled; using 1 worker instead of ${userParallelism} until it does`,
        );
      }

      // Initialize per-worker arrays.
      workerPhaseRef.current = Array.from({ length: parallelism }, () => 'loading');
      workerProgressRef.current = Array.from({ length: parallelism }, () => null);
      workerJobIdRef.current = Array.from({ length: parallelism }, () => null);
      workerJobStartedAtRef.current = Array.from(
        { length: parallelism },
        () => null,
      );
      workerConsecutiveErrorsRef.current = Array.from(
        { length: parallelism },
        () => 0,
      );

      // Spawn workers.
      const workers: Worker[] = [];
      for (let i = 0; i < parallelism; i += 1) {
        const worker = new Worker(
          new URL('../../lib/screening/local/worker.ts', import.meta.url),
          { type: 'module' },
        );
        workers.push(worker);
        worker.addEventListener('message', makeMessageHandler(i));
        const initMsg: TWorkerInbound = {
          type: 'init',
          webllmModelId: modelInfo.webllmModelId,
        };
        worker.postMessage(initMsg);
      }
      workersRef.current = workers;
      recomputeAggregateState();
    })();

    return () => {
      cancelled = true;
      if (repollHandleRef.current) {
        clearTimeout(repollHandleRef.current);
        repollHandleRef.current = null;
      }
      for (const w of workersRef.current) {
        if (!w) continue;
        try {
          w.postMessage({ type: 'terminate' } satisfies TWorkerInbound);
        } catch {
          // Worker already gone; ignore.
        }
        w.terminate();
      }
      workersRef.current = [];
      workerPhaseRef.current = [];
      workerProgressRef.current = [];
      workerJobIdRef.current = [];
      workerJobStartedAtRef.current = [];
      workerConsecutiveErrorsRef.current = [];
      // eslint-disable-next-line react-hooks/exhaustive-deps
      inFlightIdsRef.current.clear();
      publishInFlight();
      profileRef.current = null;
    };
    // gateIsSettled (a normalised bool) is the dep that gates the
    // worker count. The full gate object would change on every 5s
    // poll and re-tear-down workers; the normalised bool only
    // transitions when learning actually settles.
  }, [
    settings,
    settings?.screeningLocalEnabled,
    settings?.screeningLocalModelVariant,
    settings?.screeningLocalParallelism,
    gateIsSettled,
    makeMessageHandler,
    publishInFlight,
    recomputeAggregateState,
  ]);

  // Backlog tracking. Independent of the local workers so the count
  // is surfaced even when none has loaded yet.
  const runScan = useCallback(async () => {
    setScanning(true);
    scanningRef.current = true;
    const TARGET_JOBS_PER_SCAN = 1000;
    const MAX_ITER = 2000;
    let totalEmbedded = 0;
    let totalPassed = 0;
    let totalScreenedOut = 0;
    let iter = 0;
    try {
      while (totalEmbedded < TARGET_JOBS_PER_SCAN && iter < MAX_ITER) {
        iter += 1;
        const result = await drainEmbeddingQueueAction();
        totalEmbedded += result.embedded;
        totalPassed += result.passed;
        totalScreenedOut += result.screenedOut;
        // Animate the row exit only when the batch dropped a small
        // number of jobs. Larger batches (typically a fresh-import
        // burning down a big backlog) would translate into a wall of
        // simultaneous swipes; better to just refetch silently.
        if (
          result.droppedIds.length > 0 &&
          result.droppedIds.length <= EXIT_ANIMATION_BATCH_BAIL
        ) {
          for (const id of result.droppedIds) markDropped(id, EScreenStage.Embedding);
        }
        emitRefresh(REFRESH_EVENTS.Jobs);
        try {
          const fresh = await getUnscreenedCountsAction();
          setUnscreenedPending(fresh.embeddingPending);
        } catch {
          // Non-fatal.
        }
        if (result.embedded === 0 && result.skipped === 0) break;
      }
      if (totalEmbedded > 0 || totalScreenedOut > 0) {
        notifications.show({
          color: 'teal',
          icon: <IconCheck size={18} />,
          title: 'Backlog scanned',
          message: `${totalEmbedded} screened (${totalPassed} passed, ${totalScreenedOut} dropped)`,
        });
      }
    } catch (err) {
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Scan failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setScanning(false);
      scanningRef.current = false;
    }
  }, [markDropped]);

  useEffect(() => {
    if (!settings) return;
    if (
      settings.screeningEmbeddingEnabled === undefined &&
      settings.screeningLocalEnabled === undefined
    ) {
      return;
    }
    let cancelled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const fresh = await getUnscreenedCountsAction();
        if (cancelled) return;
        setUnscreenedPending(fresh.embeddingPending);
        if (fresh.embeddingPending > 0 && !scanningRef.current) {
          await runScan();
        }
        if (cancelled) return;
        const nextDelay =
          fresh.embeddingPending > BACKLOG_BUSY_THRESHOLD
            ? BACKLOG_POLL_BUSY_MS
            : BACKLOG_POLL_IDLE_MS;
        timeoutHandle = setTimeout(() => void tick(), nextDelay);
      } catch {
        // Polling errors are not fatal; reschedule at the idle cadence.
        if (!cancelled) {
          timeoutHandle = setTimeout(() => void tick(), BACKLOG_POLL_IDLE_MS);
        }
      }
    };
    void tick();
    return () => {
      cancelled = true;
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
    };
  }, [settings, runScan]);

  if (state.phase === 'idle' && unscreenedPending === 0 && !scanning) {
    return null;
  }

  return (
    <DriverStatus
      state={state}
      queueDepth={queueDepth}
      processedThisSession={processedThisSession}
      sessionStartDepth={sessionStartDepth}
      errorsThisSession={errorsThisSession}
      lastVerdictAt={lastVerdictAt}
      currentJobStartedAt={oldestJobStartedAt}
      unscreenedPending={unscreenedPending}
      scanning={scanning}
      onScan={() => void runScan()}
    />
  );
}

function ScanForUnscreenedButton({
  count,
  scanning,
  onScan,
}: {
  count: number;
  scanning: boolean;
  onScan: () => void;
}) {
  if (count === 0 && !scanning) return null;
  return (
    <Button
      size="xs"
      variant="light"
      leftSection={<IconRadar2 size={14} stroke={1.6} />}
      onClick={onScan}
      loading={scanning}
      disabled={scanning || count === 0}
    >
      {scanning ? `Scanning... ${count} left` : `Scan ${count} unscreened`}
    </Button>
  );
}

function formatElapsed(ms: number): string {
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return rem === 0 ? `${mins}m` : `${mins}m ${rem}s`;
}

function useNowEverySecond(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function DriverStatus({
  state,
  queueDepth,
  processedThisSession,
  sessionStartDepth,
  errorsThisSession,
  lastVerdictAt,
  currentJobStartedAt,
  unscreenedPending,
  scanning,
  onScan,
}: {
  state: TDriverState;
  queueDepth: number;
  processedThisSession: number;
  sessionStartDepth: number | null;
  errorsThisSession: number;
  lastVerdictAt: number | null;
  currentJobStartedAt: number | null;
  unscreenedPending: number;
  scanning: boolean;
  onScan: () => void;
}) {
  const now = useNowEverySecond(state.phase === 'screening');

  if (state.phase === 'idle') {
    return (
      <Paper p="sm" withBorder>
        <Group justify="space-between" wrap="nowrap" gap="md">
          <Group gap="xs" wrap="nowrap">
            <IconRadar2 size={16} stroke={1.6} />
            <Stack gap={0}>
              <Text size="sm" fw={500}>
                {scanning
                  ? `Scanning... ${unscreenedPending} unscreened remaining`
                  : `${unscreenedPending} unscreened job${unscreenedPending === 1 ? '' : 's'}`}
              </Text>
              <Text size="xs" c="dimmed">
                Pending the embedding screen.
              </Text>
            </Stack>
          </Group>
          <ScanForUnscreenedButton
            count={unscreenedPending}
            scanning={scanning}
            onScan={onScan}
          />
        </Group>
      </Paper>
    );
  }
  if (state.phase === 'checking_gpu') {
    return (
      <Paper p="sm" withBorder>
        <Group gap="xs">
          <IconCpu size={16} />
          <Text size="sm" c="dimmed">
            Checking GPU support for the local screen...
          </Text>
        </Group>
      </Paper>
    );
  }
  if (state.phase === 'gpu_unavailable') {
    return (
      <Alert
        icon={<IconAlertTriangle size={18} />}
        color="yellow"
        title="Local screen unavailable"
        variant="light"
      >
        <Stack gap="xs">
          <Text size="sm">{state.gpu.reason}</Text>
          <Text size="xs" c="dimmed">
            The embedding screen and Claude scoring still run normally. Turn
            the local toggle off in{' '}
            <Anchor href="/settings" size="xs">
              Settings
            </Anchor>{' '}
            to dismiss this notice.
          </Text>
        </Stack>
      </Alert>
    );
  }
  if (state.phase === 'no_profile') {
    return (
      <Alert
        icon={<IconAlertTriangle size={18} />}
        color="yellow"
        title="Add a profile first"
        variant="light"
      >
        <Text size="sm">
          The local screen reasons about jobs against your profile. Set up
          your profile in{' '}
          <Anchor href="/profile" size="xs">
            Profile
          </Anchor>{' '}
          and screening will pick up automatically.
        </Text>
      </Alert>
    );
  }
  if (state.phase === 'loading_model') {
    const pct = Math.round((state.progress || 0) * 100);
    return (
      <Paper p="sm" withBorder>
        <Stack gap="xs">
          <Group gap="xs" justify="space-between">
            <Group gap="xs">
              <IconDownload size={16} />
              <Text size="sm" fw={500}>
                Loading local screening model
                {state.total > 1
                  ? ` (${state.loaded} of ${state.total} workers ready)`
                  : ''}
              </Text>
            </Group>
            <Badge variant="light">{pct}%</Badge>
          </Group>
          <Progress value={pct} size="sm" />
          <Text size="xs" c="dimmed">
            {state.text}
          </Text>
        </Stack>
      </Paper>
    );
  }
  if (state.phase === 'ready') {
    if (queueDepth === 0) {
      return (
        <Paper p="sm" withBorder>
          <Group justify="space-between" wrap="nowrap" gap="md">
            <Group gap="xs">
              <IconCircleCheck size={16} color="var(--mantine-color-teal-6)" />
              <Text size="sm" c="dimmed">
                Local screen idle. Will pick up new jobs as they arrive.
              </Text>
            </Group>
            <ScanForUnscreenedButton
              count={unscreenedPending}
              scanning={scanning}
              onScan={onScan}
            />
          </Group>
        </Paper>
      );
    }
    return (
      <Paper p="sm" withBorder>
        <Group justify="space-between" wrap="nowrap" gap="md">
          <Group gap="xs">
            <IconCpu size={16} />
            <Text size="sm">
              Local screen ready. {queueDepth} job
              {queueDepth === 1 ? '' : 's'} in queue.
            </Text>
          </Group>
          <ScanForUnscreenedButton
            count={unscreenedPending}
            scanning={scanning}
            onScan={onScan}
          />
        </Group>
      </Paper>
    );
  }
  if (state.phase === 'screening') {
    const total = sessionStartDepth ?? queueDepth + processedThisSession;
    const done = processedThisSession;
    const pct =
      total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null;
    const currentElapsedMs =
      currentJobStartedAt !== null ? now - currentJobStartedAt : null;
    const sinceLastVerdictMs =
      lastVerdictAt !== null ? now - lastVerdictAt : null;
    const looksStalled =
      currentElapsedMs !== null && currentElapsedMs > 90_000 && done === 0;
    return (
      <Paper p="sm" withBorder>
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap" gap="md">
            <Group gap="xs">
              <IconCpu size={16} />
              <Text size="sm">
                Local screen working ({queueDepth} in queue,{' '}
                {state.activeCount} worker
                {state.activeCount === 1 ? '' : 's'} busy) ·{' '}
                {done} processed this session
              </Text>
            </Group>
            <ScanForUnscreenedButton
              count={unscreenedPending}
              scanning={scanning}
              onScan={onScan}
            />
          </Group>
          <Group gap="md" wrap="wrap">
            {currentElapsedMs !== null ? (
              <Text size="xs" c={looksStalled ? 'orange' : 'dimmed'}>
                Oldest in-flight job: {formatElapsed(currentElapsedMs)}
                {looksStalled
                  ? ' (no verdict yet, may be stalled. Check DevTools console for [njs:local-worker] logs)'
                  : ''}
              </Text>
            ) : null}
            {sinceLastVerdictMs !== null ? (
              <Text size="xs" c="dimmed">
                Last verdict: {formatElapsed(sinceLastVerdictMs)} ago
              </Text>
            ) : done === 0 ? (
              <Text size="xs" c="dimmed">
                No verdicts yet this session.
              </Text>
            ) : null}
            {errorsThisSession > 0 ? (
              <Text size="xs" c="red">
                {errorsThisSession} error{errorsThisSession === 1 ? '' : 's'}
              </Text>
            ) : null}
          </Group>
          {pct !== null ? (
            <Progress
              size="xs"
              value={pct}
              animated
              striped
              aria-label="Local screen progress"
            />
          ) : null}
        </Stack>
      </Paper>
    );
  }
  if (state.phase === 'error') {
    return (
      <Alert
        icon={<IconAlertTriangle size={18} />}
        color="red"
        title="Local screen error"
        variant="light"
      >
        <Text size="sm">{state.message}</Text>
      </Alert>
    );
  }
  return null;
}
