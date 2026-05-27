'use client';

import { Container, Group, Skeleton, Stack } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';

import { AddJobButton } from '@/components/jobs/AddJobButton';
import { JobFilters } from '@/components/jobs/JobFilters';
import { JobsVirtualList } from '@/components/jobs/JobsVirtualList';
import { NoJobsState } from '@/components/jobs/NoJobsState';
import { RefreshSourcesButton } from '@/components/jobs/RefreshSourcesButton';
import { ScreeningGateModal } from '@/components/jobs/ScreeningGateModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { adapter } from '@/lib/storage';
import { EJobSort } from '@/lib/storage/types/EJobSort';
import { EJobStatus } from '@/lib/storage/types/EJobStatus';
import type { IJobFilters } from '@/lib/storage/types/IJobFilters';

const DEFAULT_FILTERS: IJobFilters = {
  status: [EJobStatus.New, EJobStatus.Saved, EJobStatus.Applied],
  sortBy: EJobSort.Ranking,
};

const SORT_VALUES: ReadonlySet<EJobSort> = new Set(Object.values(EJobSort));

/**
 * True when any filter beyond the default status set is in play. Used to
 * tell `NoJobsState` to render a "no matches" view rather than auto-firing
 * a refresh against the user's sources.
 */
function hasActiveFilters(filters: IJobFilters): boolean {
  const status = filters.status ?? [];
  const statusIsDefault =
    status.length === 3 &&
    status.includes(EJobStatus.New) &&
    status.includes(EJobStatus.Saved) &&
    status.includes(EJobStatus.Applied);
  if (!statusIsDefault) return true;
  if ((filters.sources?.length ?? 0) > 0) return true;
  if ((filters.countries?.length ?? 0) > 0) return true;
  if ((filters.languages?.length ?? 0) > 0) return true;
  if (filters.remoteOnly) return true;
  if (typeof filters.minFitScore === 'number') return true;
  if ((filters.search?.trim().length ?? 0) > 0) return true;
  return false;
}

/**
 * Subset of IJobFilters worth persisting across visits. Skip:
 *   - `search`     transient query, retyped each session
 *   - `includeScreened`  audit-only escape hatch, not a default
 * Persisting the rest avoids the user re-toggling "Remote only" / "Manual
 * only" and re-picking their country every time they open /jobs, which
 * is especially important because clearing those filters causes
 * the cascade to score jobs the user never wanted scored.
 */
const FILTERS_STORAGE_KEY = 'njs:jobs:filters';
type TPersistedFilters = Pick<
  IJobFilters,
  'status' | 'sources' | 'remoteOnly' | 'countries' | 'languages' | 'minFitScore' | 'sortBy'
>;

function loadFilters(): IJobFilters {
  if (typeof window === 'undefined') return DEFAULT_FILTERS;
  try {
    const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as Partial<TPersistedFilters>;
    const sortBy =
      parsed.sortBy && SORT_VALUES.has(parsed.sortBy)
        ? parsed.sortBy
        : DEFAULT_FILTERS.sortBy;
    return {
      status: parsed.status ?? DEFAULT_FILTERS.status,
      sources: parsed.sources,
      remoteOnly: parsed.remoteOnly,
      countries: parsed.countries,
      languages: parsed.languages,
      minFitScore: parsed.minFitScore,
      sortBy,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFilters(filters: IJobFilters): void {
  if (typeof window === 'undefined') return;
  const payload: TPersistedFilters = {
    status: filters.status,
    sources: filters.sources,
    remoteOnly: filters.remoteOnly,
    countries: filters.countries,
    languages: filters.languages,
    minFitScore: filters.minFitScore,
    sortBy: filters.sortBy,
  };
  try {
    window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or disabled storage; the filter still works for this
    // session, it just won't persist.
  }
}

export default function JobsPage() {
  // Initialise with DEFAULT_FILTERS so server-render output matches
  // client-render output. The persisted values land via a post-mount
  // effect; trying to read localStorage in the useState initialiser
  // would diverge from SSR and trip a hydration mismatch on the chip
  // / switch / pill state.
  const [filters, setFilters] = useState<IJobFilters>(DEFAULT_FILTERS);
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  useEffect(() => {
    // Sync from localStorage on mount. setState-in-effect is the
    // pattern React docs recommend for reading from browser-only APIs
    // that aren't available during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilters(loadFilters());
    setFiltersHydrated(true);
  }, []);
  useEffect(() => {
    if (!filtersHydrated) return;
    saveFilters(filters);
  }, [filters, filtersHydrated]);
  const jobs = adapter.useJobs(filters);
  const settings = adapter.useSettings();
  const [gateDismissed, setGateDismissed] = useState(false);

  // First-visit gate: open only once both settings have loaded and at least
  // one screening toggle is still unset. `gateDismissed` keeps it from
  // re-opening after the user saves before the settings refresh propagates.
  const gateOpen =
    !gateDismissed &&
    settings !== undefined &&
    (settings.screeningEmbeddingEnabled === undefined ||
      settings.screeningLocalEnabled === undefined);

  const filtersActive = hasActiveFilters(filters);
  // Preserve the user's chosen sort when they wipe filters. Sort isn't a
  // filter and shouldn't snap back just because they hit "Clear".
  const clearFilters = useCallback(
    () => setFilters((prev) => ({ ...DEFAULT_FILTERS, sortBy: prev.sortBy })),
    [],
  );

  return (
    <Container size="lg" px={0}>
      <PageHeader
        title="Jobs"
        description="Pulled from your sources or added by hand. Save what you like, hide what you don't, tailor on click."
        actions={
          <Group gap="sm" wrap="nowrap">
            <RefreshSourcesButton />
            <AddJobButton />
          </Group>
        }
      />

      {/*
       * ScreeningStatusProvider + LocalScreenDriver live in
       * AppShellLayout now (above {children}) so the local LLM
       * workers persist across navigation rather than being torn
       * down every time the user leaves /jobs. JobsVirtualList still
       * reads the in-flight job ids from the same context via
       * useScreeningStatus.
       */}
      <Stack gap="md">
        <JobFilters value={filters} onChange={setFilters} totalCount={jobs?.length ?? 0} />

        {jobs === undefined ? (
          <Stack gap="md">
            <Skeleton height={92} />
            <Skeleton height={92} />
            <Skeleton height={92} />
          </Stack>
        ) : jobs.length === 0 ? (
          <NoJobsState
            filtered={filtersActive}
            onClearFilters={filtersActive ? clearFilters : undefined}
          />
        ) : (
          <JobsVirtualList jobs={jobs} />
        )}
      </Stack>

      <ScreeningGateModal opened={gateOpen} onSaved={() => setGateDismissed(true)} />
    </Container>
  );
}
