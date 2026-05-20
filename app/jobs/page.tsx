'use client';

import { Container, Skeleton, Stack } from '@mantine/core';
import { useState } from 'react';

import { JobFilters } from '@/components/jobs/JobFilters';
import { JobsVirtualList } from '@/components/jobs/JobsVirtualList';
import { NoJobsState } from '@/components/jobs/NoJobsState';
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

  return (
    <Container size="lg" px={0}>
      <PageHeader
        title="Jobs"
        description="Ingested postings. Save what you like, hide what you don't, tailor on click."
      />

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
    </Container>
  );
}
