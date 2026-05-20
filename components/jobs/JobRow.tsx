'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconBuildingSkyscraper,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconMapPin,
  IconStar,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useTransition } from 'react';

import { adapter } from '@/lib/storage';
import { EJobStatus } from '@/lib/storage/types/EJobStatus';

import { FitScoreRing } from './FitScoreRing';
import type { IJobRowProps } from './types/IJobRowProps';

function statusBadge(status: EJobStatus) {
  switch (status) {
    case EJobStatus.Saved:
      return (
        <Badge size="xs" variant="light" color="indigo">
          Saved
        </Badge>
      );
    case EJobStatus.Applied:
      return (
        <Badge size="xs" variant="light" color="violet">
          Applied
        </Badge>
      );
    case EJobStatus.Hidden:
      return (
        <Badge size="xs" variant="light" color="gray">
          Hidden
        </Badge>
      );
    default:
      return null;
  }
}

export function JobRow({ job }: IJobRowProps) {
  const [pending, startTransition] = useTransition();

  function update(status: EJobStatus) {
    if (typeof job.id !== 'number') return;
    startTransition(async () => {
      await adapter.updateJobStatus(job.id!, status);
    });
  }

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="md">
        <Group gap="md" wrap="nowrap" align="flex-start" style={{ flex: 1, minWidth: 0 }}>
          <FitScoreRing score={job.fitScore} />
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text
              fw={600}
              truncate
              component={Link}
              href={typeof job.id === 'number' ? `/jobs/${job.id}` : '#'}
            >
              {job.title}
            </Text>
            <Group gap={6} c="dimmed">
              <IconBuildingSkyscraper size={14} stroke={1.6} />
              <Text size="sm">{job.company}</Text>
              {job.location ? (
                <>
                  <Text size="sm">·</Text>
                  <IconMapPin size={14} stroke={1.6} />
                  <Text size="sm" truncate>
                    {job.location}
                  </Text>
                </>
              ) : null}
            </Group>
            <Group gap={6} mt={2}>
              <Badge size="xs" variant="light" color="gray">
                {job.source}
              </Badge>
              {job.remote ? (
                <Badge size="xs" variant="light" color="teal">
                  Remote
                </Badge>
              ) : null}
              {statusBadge(job.status)}
            </Group>
          </Stack>
        </Group>
        <Group gap="xs" wrap="nowrap">
          {job.url ? (
            <Tooltip label="Open posting" withArrow>
              <ActionIcon
                variant="default"
                aria-label="Open posting"
                component="a"
                href={job.url}
                target="_blank"
                rel="noreferrer"
              >
                <IconExternalLink size={16} stroke={1.6} />
              </ActionIcon>
            </Tooltip>
          ) : null}
          {job.status !== EJobStatus.Saved ? (
            <Tooltip label="Save" withArrow>
              <ActionIcon
                variant="default"
                onClick={() => update(EJobStatus.Saved)}
                disabled={pending}
                aria-label="Save"
              >
                <IconStar size={16} stroke={1.6} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label="Unsave" withArrow>
              <ActionIcon
                variant="light"
                color="indigo"
                onClick={() => update(EJobStatus.New)}
                disabled={pending}
                aria-label="Unsave"
              >
                <IconEye size={16} stroke={1.6} />
              </ActionIcon>
            </Tooltip>
          )}
          {job.status !== EJobStatus.Hidden ? (
            <Tooltip label="Hide" withArrow>
              <ActionIcon
                variant="subtle"
                onClick={() => update(EJobStatus.Hidden)}
                disabled={pending}
                aria-label="Hide"
              >
                <IconEyeOff size={16} stroke={1.6} />
              </ActionIcon>
            </Tooltip>
          ) : null}
          <Button
            size="xs"
            variant="light"
            component={Link}
            href={typeof job.id === 'number' ? `/jobs/${job.id}` : '#'}
          >
            View
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}
