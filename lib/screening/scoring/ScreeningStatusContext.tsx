'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type {
  ILocalRankItem,
  ILocalRankStory,
  ILocalScreenJob,
} from '@/lib/screening/local/types';
import { EScreenStage } from '@/lib/storage/types/EScreenStage';

/**
 * Cross-component channel for one-shot story-ranking requests handled by the
 * same LocalScreenDriver that runs job screening. The CoverLetterPanel
 * submits a request via `submitRankRequest`; the driver picks it up, pauses
 * screening dispatch, runs the rank on a free worker, resolves the promise,
 * and resumes screening.
 *
 * Only one ranking request is tracked at a time; submitting a new one while
 * an older one is still pending rejects the older promise.
 */
export interface IRankRequest {
  /** Caller-supplied id, surfaced back in the result so callers can match. */
  requestId: string;
  job: ILocalScreenJob;
  stories: ILocalRankStory[];
}

export type TRankResult =
  | { ok: true; requestId: string; items: ILocalRankItem[] }
  | { ok: false; requestId: string; error: string };

/**
 * Shared screening state between LocalScreenDriver (writer) and the
 * virtual list / row badges (readers). Surfaces the set of jobs
 * being processed by local workers RIGHT NOW so the matching rows
 * can render a shimmer instead of the static "queued" pulse. The set
 * has N entries when parallelism > 1 (one per active worker).
 *
 * Also tracks `recentlyDroppedIds`: jobs the cascade just rejected,
 * held for a short window so the row can play an exit animation
 * before the refetch removes it from the list. Entries auto-expire
 * via setTimeout when added.
 */
export interface IScreeningStatus {
  /** Job ids the local workers are screening right now. */
  currentLocalJobIds: ReadonlySet<number>;
  setCurrentLocalJobIds: (ids: ReadonlySet<number>) => void;
  /**
   * Map of job id -> which stage rejected it. Populated when the
   * cascade drops a job; the entry auto-expires after the animation
   * duration. Readers (JobRow, JobsVirtualList) use this to play
   * the exit treatment and keep the row mounted briefly.
   */
  recentlyDroppedIds: ReadonlyMap<number, EScreenStage>;
  /**
   * Mark a single job as just-dropped. Schedules removal after the
   * exit animation. Safe to call from event handlers.
   */
  markDropped: (jobId: number, stage: EScreenStage) => void;
  /**
   * Active ranking request waiting for the driver to handle it. `null` means
   * no work outstanding. Drivers poll this; UI shouldn't read it directly.
   */
  pendingRankRequest: IRankRequest | null;
  /**
   * Submit a ranking request. Resolves when the driver returns a result
   * (success or failure). Submitting again while one is pending rejects
   * the older promise so the caller sees the freshest result only.
   */
  submitRankRequest: (req: IRankRequest) => Promise<TRankResult>;
  /**
   * Driver-only: resolve the pending request and clear the slot. UI never
   * calls this; it lives on the context so the driver can reach it without
   * a custom ref-passing mechanism.
   */
  resolveRankRequest: (result: TRankResult) => void;
}

const EMPTY_SET: ReadonlySet<number> = new Set();
const EMPTY_MAP: ReadonlyMap<number, EScreenStage> = new Map();

const NOOP = () => {
  // Default for components that read the context outside a provider:
  // the screening state simply is not available.
};

const ScreeningStatusContext = createContext<IScreeningStatus>({
  currentLocalJobIds: EMPTY_SET,
  setCurrentLocalJobIds: NOOP,
  recentlyDroppedIds: EMPTY_MAP,
  markDropped: NOOP,
  pendingRankRequest: null,
  submitRankRequest: async () => ({
    ok: false,
    requestId: '',
    error: 'No screening provider available; ranking is disabled.',
  }),
  resolveRankRequest: NOOP,
});

/**
 * Total time the dropped row stays mounted: 200ms red flash + pill
 * swap, then 400ms slide and fade. Keep in sync with the
 * `njs-row-exit` keyframe in globals.css.
 */
export const ROW_EXIT_DURATION_MS = 600;

export function ScreeningStatusProvider({ children }: { children: ReactNode }) {
  const [currentLocalJobIds, setCurrentLocalJobIds] = useState<ReadonlySet<number>>(
    EMPTY_SET,
  );
  const [recentlyDroppedIds, setRecentlyDroppedIds] = useState<
    ReadonlyMap<number, EScreenStage>
  >(EMPTY_MAP);

  // setTimeout handles indexed by job id so a re-drop of the same id
  // (rare, but possible if the cascade re-queued and rejected again)
  // resets the timer rather than leaving a stale removal scheduled.
  const expiryHandlesRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // Active rank request slot. Only one request is tracked at a time; if the
  // caller submits a fresh one the older promise is rejected so callers only
  // ever see the freshest result.
  const [pendingRankRequest, setPendingRankRequest] = useState<IRankRequest | null>(
    null,
  );
  const pendingRankResolverRef = useRef<((r: TRankResult) => void) | null>(null);

  const submitRankRequest = useCallback(
    (req: IRankRequest) => {
      const existingResolver = pendingRankResolverRef.current;
      if (existingResolver) {
        existingResolver({
          ok: false,
          requestId: req.requestId,
          error: 'Superseded by a newer ranking request.',
        });
      }
      return new Promise<TRankResult>((resolve) => {
        pendingRankResolverRef.current = resolve;
        setPendingRankRequest(req);
      });
    },
    [],
  );

  const resolveRankRequest = useCallback((result: TRankResult) => {
    const resolver = pendingRankResolverRef.current;
    pendingRankResolverRef.current = null;
    setPendingRankRequest(null);
    if (resolver) resolver(result);
  }, []);

  const markDropped = useCallback((jobId: number, stage: EScreenStage) => {
    setRecentlyDroppedIds((prev) => {
      const next = new Map(prev);
      next.set(jobId, stage);
      return next;
    });
    const handles = expiryHandlesRef.current;
    const existing = handles.get(jobId);
    if (existing !== undefined) clearTimeout(existing);
    const handle = setTimeout(() => {
      handles.delete(jobId);
      setRecentlyDroppedIds((prev) => {
        if (!prev.has(jobId)) return prev;
        const next = new Map(prev);
        next.delete(jobId);
        return next;
      });
    }, ROW_EXIT_DURATION_MS);
    handles.set(jobId, handle);
  }, []);

  // Clear any in-flight expiry timers when the provider unmounts so
  // they don't fire against a torn-down setState.
  useEffect(() => {
    const handles = expiryHandlesRef.current;
    return () => {
      for (const handle of handles.values()) clearTimeout(handle);
      handles.clear();
    };
  }, []);

  const value = useMemo<IScreeningStatus>(
    () => ({
      currentLocalJobIds,
      setCurrentLocalJobIds,
      recentlyDroppedIds,
      markDropped,
      pendingRankRequest,
      submitRankRequest,
      resolveRankRequest,
    }),
    [
      currentLocalJobIds,
      recentlyDroppedIds,
      markDropped,
      pendingRankRequest,
      submitRankRequest,
      resolveRankRequest,
    ],
  );
  return (
    <ScreeningStatusContext.Provider value={value}>
      {children}
    </ScreeningStatusContext.Provider>
  );
}

export function useScreeningStatus(): IScreeningStatus {
  return useContext(ScreeningStatusContext);
}
