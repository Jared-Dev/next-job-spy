'use client';

import { useSyncExternalStore } from 'react';

import {
  getAutoTuneGateAction,
  type IAutoTuneGate,
} from '@/lib/storage/local/actions/screening';

/**
 * Shared subscription to the auto-tune gate. ONE poll runs for the whole app
 * regardless of how many components call this hook (it's used per row in the
 * jobs list, so an interval per hook instance would multiply into a
 * hailstorm). The cadence slows once the gate is settled, since the value
 * barely changes after that, and identical fetches do not re-render
 * consumers.
 *
 * The gate's job: tell the Claude-scoring paths (view-driven scoring pump,
 * Score-now button, Rank-all button) whether they're allowed to spend tokens
 * yet, so we don't burn calls on a cascade whose embedding threshold the
 * system hasn't tuned. When auto-tune is OFF, the gate is always open
 * (autoTuneEnabled=false, isSettled=true).
 */

const POLL_MS_UNSETTLED = 5_000;
const POLL_MS_SETTLED = 30_000;

let gate: IAutoTuneGate | null = null;
let subscribers = 0;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
const listeners = new Set<() => void>();

function gatesEqual(
  a: IAutoTuneGate | null,
  b: IAutoTuneGate | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.autoTuneEnabled === b.autoTuneEnabled &&
    a.isSettled === b.isSettled &&
    a.confidence === b.confidence
  );
}

async function fetchNow(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const fresh = await getAutoTuneGateAction();
    if (!gatesEqual(fresh, gate)) {
      gate = fresh;
      for (const listener of listeners) listener();
    }
  } catch {
    // Non-fatal; next tick catches up.
  } finally {
    inFlight = false;
  }
}

function schedule(): void {
  if (pollTimer !== null || subscribers === 0) return;
  const delay = gate?.isSettled ? POLL_MS_SETTLED : POLL_MS_UNSETTLED;
  pollTimer = setTimeout(async () => {
    pollTimer = null;
    await fetchNow();
    schedule();
  }, delay);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  subscribers += 1;
  if (subscribers === 1) {
    void fetchNow().then(schedule);
  }
  return () => {
    listeners.delete(listener);
    subscribers -= 1;
    if (subscribers === 0 && pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  };
}

function getSnapshot(): IAutoTuneGate | null {
  return gate;
}

function getServerSnapshot(): IAutoTuneGate | null {
  return null;
}

export function useAutoTuneGate(): IAutoTuneGate | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
