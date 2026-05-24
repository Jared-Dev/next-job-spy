'use client';

import { useEffect, useRef } from 'react';

import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import { isProfileMeaningful } from '@/lib/profile/isProfileMeaningful';
import { useAutoTuneGate } from '@/lib/screening/scoring/useAutoTuneGate';
import { adapter } from '@/lib/storage';
import { EPipelineStatus } from '@/lib/storage/types/EPipelineStatus';
import type { IJob } from '@/lib/storage/types/IJob';
import type { IProfile } from '@/lib/storage/types/IProfile';

/**
 * View-driven Claude scoring. We pay for what the user actually looks
 * at: a polling pump reads the virtualizer's currently-visible window
 * (plus N ahead) and batches the unscored, cascade-passed jobs into
 * /api/ai/rank calls. In-flight ids are tracked in a ref so the pump
 * never enqueues a job twice while a request is outstanding.
 *
 * The pump is a setInterval rather than a per-scroll listener: that
 * decouples scoring from scroll events (which can fire hundreds per
 * second) and gives a natural throttle.
 */
export interface IUseViewDrivenScoringParams {
  jobs: IJob[];
  /**
   * Snapshot of currently-visible row indices. Called each tick; the
   * hook owns the cadence, not the caller.
   */
  getVisibleIndices: () => number[];
  /** Score this many rows ahead of the last visible one. Default 10. */
  prefetchAhead?: number;
  /** Maximum jobs per /api/ai/rank call. Default 10. */
  batchSize?: number;
  /** Pump interval; tune up if Claude is slow, down if you want livelier UX. */
  intervalMs?: number;
  /**
   * Notified when a job is sent to Claude or its score returns. Used by
   * the UI to render per-row scoring states. The set is the same
   * reference each call; copy if you need a stable snapshot.
   */
  onInFlightChange?: (inFlight: ReadonlySet<number>) => void;
}

interface IRankResultRow {
  id: string;
  fitScore: number;
  fitNotes: string;
}

interface IRankResponse {
  results: IRankResultRow[];
  error?: string;
}

const DEFAULT_PREFETCH = 10;
const DEFAULT_BATCH = 10;
const DEFAULT_INTERVAL_MS = 1500;
const MAX_DESCRIPTION_CHARS = 4000;

/**
 * Append an explicit truncation marker when we cap a description so
 * Claude doesn't interpret the cut-off as broken input and bail into
 * conversational mode. Without it, postings whose descriptions
 * happen to be longer than the cap come back as "I notice the
 * description appears to be truncated, could you provide..." prose
 * instead of the JSON the route expects.
 */
function truncateForRank(desc: string | undefined): string | undefined {
  if (!desc) return desc;
  if (desc.length <= MAX_DESCRIPTION_CHARS) return desc;
  return `${desc.slice(0, MAX_DESCRIPTION_CHARS)}\n\n[Description truncated by client at ${MAX_DESCRIPTION_CHARS} chars; score what is shown.]`;
}

export function useViewDrivenScoring({
  jobs,
  getVisibleIndices,
  prefetchAhead = DEFAULT_PREFETCH,
  batchSize = DEFAULT_BATCH,
  intervalMs = DEFAULT_INTERVAL_MS,
  onInFlightChange,
}: IUseViewDrivenScoringParams): void {
  const profile = adapter.useProfile();
  const gate = useAutoTuneGate();

  const profileRef = useRef<IProfile | undefined>(undefined);
  const profileReadyRef = useRef(false);
  const jobsRef = useRef(jobs);
  const getVisibleRef = useRef(getVisibleIndices);
  const onInFlightRef = useRef(onInFlightChange);
  const inFlightRef = useRef<Set<number>>(new Set());
  const gateOpenRef = useRef(true);

  // Mirror the latest values into refs so the interval pump always sees
  // the current state without having to be re-created (which would
  // cancel any in-flight scoring).
  useEffect(() => {
    profileRef.current = profile;
    profileReadyRef.current = isProfileMeaningful(profile);
  }, [profile]);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);
  useEffect(() => {
    getVisibleRef.current = getVisibleIndices;
  }, [getVisibleIndices]);
  useEffect(() => {
    onInFlightRef.current = onInFlightChange;
  }, [onInFlightChange]);
  useEffect(() => {
    // Mirror the auto-tune gate into a ref so the pump tick reads
    // the freshest value without re-arming the interval.
    gateOpenRef.current = gate === null ? true : gate.isSettled;
  }, [gate]);

  useEffect(() => {
    const notifyInFlight = () => {
      onInFlightRef.current?.(inFlightRef.current);
    };

    const tick = async () => {
      if (!profileReadyRef.current) return;
      // Pause Claude scoring while auto-tune is in active learning.
      // Cascade output isn't trusted yet; spending Claude tokens on
      // it would be premature. Once confidence settles, the gate
      // opens and the pump resumes from wherever it was.
      if (!gateOpenRef.current) return;
      const profileSnapshot = profileRef.current;
      if (!profileSnapshot) return;

      const visible = getVisibleRef.current();
      if (visible.length === 0) return;

      const minIdx = Math.min(...visible);
      const maxIdx = Math.max(...visible);
      const upTo = Math.min(maxIdx + prefetchAhead, jobsRef.current.length - 1);

      const candidates: IJob[] = [];
      for (let i = minIdx; i <= upTo; i += 1) {
        const job = jobsRef.current[i];
        if (!job || typeof job.id !== 'number') continue;
        if (typeof job.fitScore === 'number') continue;
        if (job.pipelineStatus !== EPipelineStatus.LocalDone) continue;
        if (inFlightRef.current.has(job.id)) continue;
        candidates.push(job);
        if (candidates.length >= batchSize) break;
      }

      if (candidates.length === 0) return;

      const ids = candidates.map((j) => j.id as number);
      ids.forEach((id) => inFlightRef.current.add(id));
      notifyInFlight();

      try {
        const res = await fetch('/api/ai/rank', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            profile: profileSnapshot,
            jobs: candidates.map((j) => ({
              id: String(j.id),
              title: j.title,
              company: j.company,
              location: j.location,
              description: truncateForRank(j.descriptionMd),
            })),
            model: EAnthropicModel.Haiku45,
          }),
        });
        const data = (await res.json()) as IRankResponse;
        if (!res.ok) {
          console.error('view-driven scoring rank failed:', data.error);
          return;
        }
        const byId = new Map(data.results.map((r) => [r.id, r]));
        for (const job of candidates) {
          const result = byId.get(String(job.id));
          if (!result || typeof job.id !== 'number') continue;
          await adapter.updateJobFit(job.id, result.fitScore, result.fitNotes);
        }
      } catch (err) {
        console.error('view-driven scoring fetch error:', err);
      } finally {
        ids.forEach((id) => inFlightRef.current.delete(id));
        notifyInFlight();
      }
    };

    const interval = setInterval(() => {
      void tick();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [prefetchAhead, batchSize, intervalMs]);
}
