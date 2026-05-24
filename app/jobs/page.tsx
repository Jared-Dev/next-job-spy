'use client';

import { Container, Skeleton, Stack } from '@mantine/core';
import { useState } from 'react';

import { AddJobButton } from '@/components/jobs/AddJobButton';
import { JobFilters } from '@/components/jobs/JobFilters';
import { JobsVirtualList } from '@/components/jobs/JobsVirtualList';
import { NoJobsState } from '@/components/jobs/NoJobsState';
import { ScreeningGateModal } from '@/components/jobs/ScreeningGateModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { adapter } from '@/lib/storage';
import { EJobStatus } from '@/lib/storage/types/EJobStatus';
import type { IJobFilters } from '@/lib/storage/types/IJobFilters';

const DEFAULT_FILTERS: IJobFilters = {
  status: [EJobStatus.New, EJobStatus.Saved, EJobStatus.Applied],
};

export default function JobsPage() {
  const [filters, setFilters] = useState<IJobFilters>(DEFAULT_FILTERS);
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

  return (
    <Container size="lg" px={0}>
      <PageHeader
        title="Jobs"
        description="Pulled from your sources or added by hand. Save what you like, hide what you don't, tailor on click."
        actions={<AddJobButton />}
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
          <NoJobsState />
        ) : (
          <JobsVirtualList jobs={jobs} />
        )}
      </Stack>

      <ScreeningGateModal opened={gateOpen} onSaved={() => setGateDismissed(true)} />
    </Container>
  );
}
