'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Shared screening state between LocalScreenDriver (writer) and the
 * virtual list / row badges (readers). Surfaces the set of jobs
 * being processed by local workers RIGHT NOW so the matching rows
 * can render a shimmer instead of the static "queued" pulse. The set
 * has N entries when parallelism > 1 (one per active worker).
 */
export interface IScreeningStatus {
  /** Job ids the local workers are screening right now. */
  currentLocalJobIds: ReadonlySet<number>;
  setCurrentLocalJobIds: (ids: ReadonlySet<number>) => void;
}

const EMPTY_SET: ReadonlySet<number> = new Set();

const NOOP = () => {
  // Default for components that read the context outside a provider:
  // the screening state simply is not available.
};

const ScreeningStatusContext = createContext<IScreeningStatus>({
  currentLocalJobIds: EMPTY_SET,
  setCurrentLocalJobIds: NOOP,
});

export function ScreeningStatusProvider({ children }: { children: ReactNode }) {
  const [currentLocalJobIds, setCurrentLocalJobIds] = useState<ReadonlySet<number>>(
    EMPTY_SET,
  );
  const value = useMemo<IScreeningStatus>(
    () => ({ currentLocalJobIds, setCurrentLocalJobIds }),
    [currentLocalJobIds],
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
