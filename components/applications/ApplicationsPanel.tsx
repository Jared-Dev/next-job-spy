'use client';

import { Anchor, Badge, Group, Paper, Skeleton, Stack, Text } from '@mantine/core';
import Link from 'next/link';
import { useMemo } from 'react';

import { adapter } from '@/lib/storage';
import { EArtifactKind } from '@/lib/storage/types/EArtifactKind';
import type { IJob } from '@/lib/storage/types/IJob';

import { applicationStatusMeta } from './applicationStatusMeta';
import styles from './ApplicationsPanel.module.css';
import type { IApplicationsPanelProps } from './types/IApplicationsPanelProps';

export function ApplicationsPanel({ limit }: IApplicationsPanelProps) {
  const applications = adapter.useApplications();
  const jobs = adapter.useJobs();
  const artifacts = adapter.useArtifacts();

  const jobsById = useMemo(() => {
    const map = new Map<number, IJob>();
    for (const job of jobs ?? []) {
      if (typeof job.id === 'number') map.set(job.id, job);
    }
    return map;
  }, [jobs]);

  const rows = useMemo(() => {
    const list = applications ?? [];
    const visible = typeof limit === 'number' ? list.slice(0, limit) : list;
    return visible.map((app) => {
      const job = typeof app.jobId === 'number' ? jobsById.get(app.jobId) : undefined;
      const docs = (artifacts ?? []).filter((a) => a.applicationId === app.id);
      return {
        app,
        job,
        resume: docs.find((a) => a.kind === EArtifactKind.TailoredResume),
        cover: docs.find((a) => a.kind === EArtifactKind.CoverLetter),
      };
    });
  }, [applications, jobsById, artifacts, limit]);

  if (applications === undefined) {
    return (
      <Stack gap="xs">
        <Skeleton height={58} />
        <Skeleton height={58} />
      </Stack>
    );
  }

  if (applications.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No applications yet. Mark a job as applied from its page to start
        tracking it here.
      </Text>
    );
  }

  return (
    <div className={styles.panel}>
      <Stack gap="xs">
        {rows.map(({ app, job, resume, cover }) => {
          const meta = applicationStatusMeta(app.status);
          return (
            <Paper key={app.id} withBorder p="sm" className={styles.row}>
              <div className={styles.primary}>
                <Anchor
                  component={Link}
                  href={job ? `/jobs/${job.id}` : '#'}
                  fw={600}
                  size="sm"
                  truncate
                >
                  {job?.title ?? 'Job'}
                </Anchor>
                <Text size="xs" c="dimmed" truncate>
                  {job?.company ?? '—'}
                </Text>
              </div>
              <div className={styles.meta}>
                <Badge size="sm" variant="light" color={meta.color}>
                  {meta.label}
                </Badge>
                <Text size="xs" c="dimmed">
                  {app.submittedAt
                    ? new Date(app.submittedAt * 1000).toLocaleDateString()
                    : 'No date'}
                </Text>
                <Group gap={10} wrap="nowrap">
                  {resume ? (
                    <Anchor
                      href={`/r/${resume.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      size="xs"
                    >
                      Résumé
                    </Anchor>
                  ) : null}
                  {cover ? (
                    <Anchor
                      href={`/r/${cover.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      size="xs"
                    >
                      Cover letter
                    </Anchor>
                  ) : null}
                </Group>
              </div>
            </Paper>
          );
        })}
      </Stack>
    </div>
  );
}
