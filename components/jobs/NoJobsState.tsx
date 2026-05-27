'use client';

import { Button, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBriefcase,
  IconCheck,
  IconExclamationCircle,
  IconFilterOff,
  IconRefresh,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { refreshAllSources } from '@/lib/jobs/refreshAllSources';
import { adapter } from '@/lib/storage';

/**
 * Empty-state surface for /jobs. Distinguishes three cases:
 *  - filters are masking the rows (don't auto-refresh; offer "Clear filters")
 *  - no sources configured (link to /sources)
 *  - sources configured but never refreshed (auto-fire the first refresh)
 */
export function NoJobsState({
  filtered = false,
  onClearFilters,
}: {
  filtered?: boolean;
  onClearFilters?: () => void;
}) {
  const settings = adapter.useSettings();
  const configs = (settings?.sourceConfigs ?? []).filter((c) => c.enabled);
  const [refreshing, setRefreshing] = useState(false);
  const autoFiredRef = useRef(false);

  async function handleRefreshAll(silent = false) {
    if (configs.length === 0) return;
    setRefreshing(true);
    const id = notifications.show({
      loading: true,
      autoClose: false,
      withCloseButton: false,
      title: silent
        ? 'Pulling jobs…'
        : `Refreshing ${configs.length} source${configs.length === 1 ? '' : 's'}…`,
      message: `Fetching ${configs.length} source${configs.length === 1 ? '' : 's'} in parallel.`,
    });
    const { fetched, inserted, failures } = await refreshAllSources(configs);
    notifications.update({
      id,
      loading: false,
      autoClose: 4000,
      withCloseButton: true,
      color: failures > 0 ? 'yellow' : 'teal',
      icon:
        failures > 0 ? <IconExclamationCircle size={18} /> : <IconCheck size={18} />,
      title: 'Refresh complete',
      message: `${fetched} fetched · ${inserted} new${
        failures > 0 ? ` · ${failures} source(s) failed` : ''
      }`,
    });
    setRefreshing(false);
  }

  // Auto-fetch the first time we land here with sources configured but no
  // jobs — UNLESS filters are masking rows. Filter-induced empties mean
  // there's data in the database the user just isn't asking to see; pulling
  // more from sources won't help and burns the user's API quota.
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (filtered) return;
    if (configs.length === 0) return;
    autoFiredRef.current = true;
    // Defer to a microtask so state mutations happen after effect commit.
    queueMicrotask(() => {
      void handleRefreshAll(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs.length, filtered]);

  if (filtered) {
    return (
      <Paper p="xl" withBorder radius="lg">
        <Stack align="center" gap="md" py="xl">
          <ThemeIcon size={56} radius="xl" variant="light" color="gray">
            <IconFilterOff size={28} stroke={1.5} />
          </ThemeIcon>
          <Stack align="center" gap={4}>
            <Title order={3} fw={600}>
              No jobs match your filters
            </Title>
            <Text c="dimmed" ta="center" maw={440}>
              Loosen or clear the filters above to see more. We won&apos;t
              auto-refresh sources while filters are masking rows.
            </Text>
          </Stack>
          {onClearFilters ? (
            <Button
              variant="default"
              leftSection={<IconFilterOff size={16} stroke={1.6} />}
              onClick={onClearFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </Stack>
      </Paper>
    );
  }

  if (configs.length === 0) {
    return (
      <EmptyState
        icon={IconBriefcase}
        title="No jobs yet"
        description='Add a board source to pull postings automatically — or use the "Add job" button above to paste one in by hand.'
        primaryAction={{ href: '/sources', label: 'Manage sources' }}
      />
    );
  }

  return (
    <Paper p="xl" withBorder radius="lg">
      <Stack align="center" gap="md" py="xl">
        <ThemeIcon size={56} radius="xl" variant="light" color="indigo">
          <IconBriefcase size={28} stroke={1.5} />
        </ThemeIcon>
        <Stack align="center" gap={4}>
          <Title order={3} fw={600}>
            {refreshing
              ? `Pulling from ${configs.length} source${configs.length === 1 ? '' : 's'}…`
              : `${configs.length} source${configs.length === 1 ? '' : 's'} configured, no jobs yet`}
          </Title>
          <Text c="dimmed" ta="center" maw={440}>
            {refreshing
              ? 'First load — fetching in parallel. Hang tight.'
              : 'Sources are passive until refreshed. Pull postings now, or jump to /sources for per-source control.'}
          </Text>
        </Stack>
        <Group gap="sm">
          <Button
            onClick={() => handleRefreshAll(false)}
            loading={refreshing}
            leftSection={<IconRefresh size={16} stroke={1.6} />}
          >
            {refreshing ? 'Refreshing…' : 'Refresh all sources'}
          </Button>
          <Button component={Link} href="/sources" variant="default">
            Manage sources
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
