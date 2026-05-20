'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Switch,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconRefresh, IconTrash } from '@tabler/icons-react';

import { getJobSource } from '@/lib/jobs/registry';

import type { ISourceConfigRowProps } from './types/ISourceConfigRowProps';

export function SourceConfigRow({
  config,
  onRefresh,
  onRemove,
  onToggle,
  busy,
}: ISourceConfigRowProps) {
  const source = getJobSource(config.sourceId);
  const paramSummary = Object.entries(config.params)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="sm" wrap="nowrap">
            <Text fw={600}>{config.label ?? source.label}</Text>
            <Badge size="xs" variant="light" color="gray">
              {source.label}
            </Badge>
            {!config.enabled ? (
              <Badge size="xs" variant="light" color="yellow">
                Disabled
              </Badge>
            ) : null}
          </Group>
          {paramSummary ? (
            <Text size="xs" c="dimmed" ff="monospace">
              {paramSummary}
            </Text>
          ) : null}
        </Stack>

        <Group gap="xs" wrap="nowrap">
          <Switch
            size="sm"
            checked={config.enabled}
            onChange={(e) => onToggle(config.id, e.currentTarget.checked)}
            aria-label={config.enabled ? 'Disable source' : 'Enable source'}
          />
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} stroke={1.6} />}
            onClick={() => onRefresh(config)}
            disabled={!config.enabled}
            loading={busy}
          >
            Refresh
          </Button>
          <Tooltip label="Remove" withArrow>
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => onRemove(config.id)}
              aria-label="Remove source"
            >
              <IconTrash size={16} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  );
}
