'use client';

import { useEffect, useRef } from 'react';

import { adapter } from '@/lib/storage';

import { refreshAllSources } from './refreshAllSources';

const CHECK_INTERVAL_MS = 30_000; // re-evaluate every 30s

export function useAutoRefresh(): void {
  const settings = adapter.useSettings();
  const runningRef = useRef(false);

  const intervalMin = settings?.autoRefreshIntervalMin ?? 0;
  const lastRefreshAt = settings?.lastRefreshAt ?? 0;
  const configs = settings?.sourceConfigs ?? [];
  const enabledCount = configs.filter((c) => c.enabled).length;

  // Stash configs in a ref so the tick callback always sees the latest list
  // without forcing the effect to re-subscribe on every render.
  const configsRef = useRef(configs);
  useEffect(() => {
    configsRef.current = configs;
  }, [configs]);

  useEffect(() => {
    if (intervalMin <= 0 || enabledCount === 0) return;
    if (typeof document === 'undefined') return;

    const tick = async () => {
      if (runningRef.current) return;
      if (document.visibilityState !== 'visible') return;
      const now = Math.floor(Date.now() / 1000);
      const elapsedSec = now - lastRefreshAt;
      if (elapsedSec < intervalMin * 60) return;
      runningRef.current = true;
      try {
        await refreshAllSources(configsRef.current);
      } catch {
        // Background refresh; surfaced when /jobs renders. Don't toast.
      } finally {
        runningRef.current = false;
      }
    };

    void tick();
    const handle = window.setInterval(tick, CHECK_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(handle);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMin, lastRefreshAt, enabledCount]);
}
