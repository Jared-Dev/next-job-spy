'use client';

import { useEffect, useState } from 'react';

import {
  getAutoTuneGateAction,
  type IAutoTuneGate,
} from '@/lib/storage/local/actions/screening';

const POLL_MS = 5000;

/**
 * Polls the auto-tune gate every few seconds. Returns null while the
 * first fetch is in flight, then a fresh IAutoTuneGate. Used by the
 * Claude-scoring paths (view-driven scoring pump, Score-now button,
 * Rank-all button) so we don't burn Claude tokens on jobs that
 * passed a cascade whose embedding threshold the system isn't yet
 * confident about.
 *
 * When auto-tune is OFF, the gate is always considered open
 * (autoTuneEnabled=false, isSettled=true) so this hook never blocks
 * anything for users who have opted out of auto-tune.
 */
export function useAutoTuneGate(): IAutoTuneGate | null {
  const [gate, setGate] = useState<IAutoTuneGate | null>(null);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const fresh = await getAutoTuneGateAction();
        if (!cancelled) setGate(fresh);
      } catch {
        // Polling failure is non-fatal; next tick catches up.
      }
    };
    void tick();
    const interval = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
  return gate;
}
