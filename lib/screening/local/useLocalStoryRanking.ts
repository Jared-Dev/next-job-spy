'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { cyrb53 } from '@/lib/ai/hashInputs';
import { useScreeningStatus } from '@/lib/screening/scoring/ScreeningStatusContext';
import { adapter } from '@/lib/storage';
import type { ICvStory } from '@/lib/cv/types/ICvStory';
import type { IJob } from '@/lib/storage/types/IJob';

import type { ILocalRankItem } from './types';

/**
 * Per-job ranking of the candidate's stories using the local LLM. Returns a
 * status + items, and a retry handler the picker can wire to a "Try again"
 * button when the LLM fails.
 *
 * Lifecycle:
 *   1. On mount / when inputs change, compute a hash. If job.storyRanking
 *      already matches the hash, return the cached items immediately (no
 *      LLM call).
 *   2. Otherwise, submit a ranking request to LocalScreenDriver via the
 *      ScreeningStatusContext. Driver pauses screening, runs rank, returns.
 *   3. While waiting, status is 'ranking'. After RANK_TIMEOUT_MS the
 *      status flips to 'timedOut' so the picker can reveal stories
 *      unranked; the request stays in flight and updates the cache when
 *      it eventually returns.
 *   4. On result, persist to job.storyRanking and surface the items.
 */

/**
 * Generous budget covering a warm local-LLM call (~5-10s for 3 stories on a
 * 1.5B model with screening yielded). First-time-on-this-device runs that
 * include WebLLM init can blow past this; the picker reveals unranked and
 * the result quietly populates the cache for next time.
 */
const RANK_TIMEOUT_MS = 20000;

export type TRankStatus =
  | 'idle'
  | 'cached'
  | 'ranking'
  | 'ready'
  | 'timedOut'
  | 'failed';

export interface ILocalStoryRankingState {
  status: TRankStatus;
  items: ILocalRankItem[] | null;
  error: string | null;
  retry: () => void;
}

function makeRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `rank_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function hashRankInputs(job: IJob, stories: ICvStory[]): string {
  const jobPart = `${job.id}|${job.title}|${job.company}|${job.descriptionMd ?? ''}`;
  const storiesPart = stories
    .map((s) => `${s.id}:${s.content}`)
    .join('||');
  return cyrb53(`rank|${jobPart}|${storiesPart}`);
}

export function useLocalStoryRanking(
  job: IJob | null,
  stories: ICvStory[],
): ILocalStoryRankingState {
  const { submitRankRequest } = useScreeningStatus();
  const [status, setStatus] = useState<TRankStatus>('idle');
  const [items, setItems] = useState<ILocalRankItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  // Track the last hash we acted on so a re-render with the same inputs
  // doesn't re-fire the rank.
  const lastHashRef = useRef<string | null>(null);
  // Token used to ignore stale resolutions (a newer effect superseded us).
  const fetchTokenRef = useRef(0);

  const hash =
    job && stories.length >= 2 ? hashRankInputs(job, stories) : null;
  const cached = job?.storyRanking;
  const hashMatches = cached?.hash === hash && hash !== null;

  const retry = useCallback(() => {
    setRetryToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const defer = (fn: () => void) => {
      void Promise.resolve().then(() => {
        if (!cancelled) fn();
      });
    };

    if (!job || typeof job.id !== 'number') {
      defer(() => {
        setStatus('idle');
        setItems(null);
        setError(null);
      });
      return () => {
        cancelled = true;
      };
    }

    if (stories.length === 0) {
      defer(() => {
        setStatus('idle');
        setItems(null);
        setError(null);
      });
      return () => {
        cancelled = true;
      };
    }

    if (stories.length === 1) {
      defer(() => {
        setStatus('idle');
        setItems([{ storyId: stories[0].id, why: '' }]);
        setError(null);
      });
      return () => {
        cancelled = true;
      };
    }

    if (hashMatches && cached) {
      defer(() => {
        setStatus('cached');
        setItems(cached.items);
        setError(null);
      });
      lastHashRef.current = hash;
      return () => {
        cancelled = true;
      };
    }

    if (lastHashRef.current === hash && retryToken === 0) {
      // We already kicked one off for this hash and aren't being retried.
      return () => {
        cancelled = true;
      };
    }

    const myToken = fetchTokenRef.current + 1;
    fetchTokenRef.current = myToken;
    lastHashRef.current = hash;

    defer(() => {
      setStatus('ranking');
      setItems(null);
      setError(null);
    });

    const timeoutHandle = setTimeout(() => {
      if (fetchTokenRef.current !== myToken) return;
      setStatus((current) => (current === 'ranking' ? 'timedOut' : current));
    }, RANK_TIMEOUT_MS);

    const requestId = makeRequestId();
    const requestJobId = job.id;
    void submitRankRequest({
      requestId,
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        descriptionMd: job.descriptionMd,
      },
      stories: stories.map((s) => ({
        id: s.id,
        title: s.title,
        content: s.content,
      })),
    })
      .then(async (result) => {
        clearTimeout(timeoutHandle);
        if (fetchTokenRef.current !== myToken || cancelled) return;
        if (result.ok) {
          try {
            await adapter.setJobStoryRanking(requestJobId, {
              hash: hash as string,
              items: result.items,
              rankedAt: Math.floor(Date.now() / 1000),
            });
          } catch {
            // Storage write failed: still surface the items in-memory.
          }
          setItems(result.items);
          setStatus('ready');
          setError(null);
        } else {
          setItems(null);
          setStatus('failed');
          setError(result.error);
        }
      })
      .catch((err: unknown) => {
        clearTimeout(timeoutHandle);
        if (fetchTokenRef.current !== myToken || cancelled) return;
        setStatus('failed');
        setError(err instanceof Error ? err.message : 'Ranking failed');
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutHandle);
    };
  }, [job, stories, hash, hashMatches, cached, retryToken, submitRankRequest]);

  return { status, items, error, retry };
}
