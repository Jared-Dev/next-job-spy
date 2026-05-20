'use client';

import { Group, Text, Tooltip } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { adapter } from '@/lib/storage';

function formatAgo(epochSec: number, nowSec: number): string {
  const delta = Math.max(0, nowSec - epochSec);
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86_400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86_400)}d ago`;
}

export function LastRefreshChip() {
  const settings = adapter.useSettings();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 15_000);
    return () => window.clearInterval(id);
  }, []);

  if (!settings) return null;
  const last = settings.lastRefreshAt;
  const intervalMin = settings.autoRefreshIntervalMin ?? 0;
  if (!last && intervalMin === 0) return null;

  const label = last ? `Refreshed ${formatAgo(last, now)}` : 'Never refreshed';
  const nextLabel =
    intervalMin > 0 && last
      ? `Next auto-refresh in ${Math.max(0, Math.ceil((last + intervalMin * 60 - now) / 60))}m`
      : intervalMin > 0
        ? `Auto every ${intervalMin}m`
        : 'Manual only';

  return (
    <Tooltip label={`${label} · ${nextLabel}`} withArrow>
      <Group gap={4} c="dimmed" wrap="nowrap">
        <IconRefresh size={14} stroke={1.6} />
        <Text size="xs">{last ? formatAgo(last, now) : 'never'}</Text>
      </Group>
    </Tooltip>
  );
}
