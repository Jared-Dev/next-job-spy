'use client';

import { Button, Container, Group, Modal, Paper, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconExclamationCircle, IconPlus, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';

import { AddSourceForm } from '@/components/sources/AddSourceForm';
import { SourceConfigRow } from '@/components/sources/SourceConfigRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ingestFromSource } from '@/lib/jobs/ingest';
import { refreshAllSources } from '@/lib/jobs/refreshAllSources';
import { adapter } from '@/lib/storage';
import type { ISourceConfig } from '@/lib/storage/types/ISourceConfig';

export default function SourcesPage() {
  const settings = adapter.useSettings();
  const configs = settings?.sourceConfigs ?? [];
  const [opened, { open, close }] = useDisclosure(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleAdd(newConfigs: ISourceConfig[]) {
    if (newConfigs.length === 0) return;
    await adapter.saveSettings({ sourceConfigs: [...configs, ...newConfigs] });
    close();
    notifications.show({
      color: 'teal',
      icon: <IconCheck size={18} />,
      title: newConfigs.length === 1 ? 'Source added' : `${newConfigs.length} sources added`,
      message:
        newConfigs.length === 1
          ? `${newConfigs[0].label ?? newConfigs[0].sourceId} is ready. Hit Refresh to pull jobs.`
          : 'Hit Refresh on each (or Refresh all) to pull jobs.',
    });
  }

  async function handleRefresh(config: ISourceConfig) {
    setBusyId(config.id);
    try {
      const result = await ingestFromSource(config);
      notifications.show({
        color: 'teal',
        icon: <IconCheck size={18} />,
        title: 'Refreshed',
        message: `${result.fetched} fetched · ${result.inserted} new · ${result.updated} updated`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Refresh failed';
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Refresh failed',
        message,
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(id: string) {
    await adapter.saveSettings({
      sourceConfigs: configs.filter((c) => c.id !== id),
    });
  }

  async function handleToggle(id: string, enabled: boolean) {
    await adapter.saveSettings({
      sourceConfigs: configs.map((c) => (c.id === id ? { ...c, enabled } : c)),
    });
  }

  async function handleRefreshAll() {
    const enabled = configs.filter((c) => c.enabled);
    if (enabled.length === 0) return;
    const id = notifications.show({
      loading: true,
      autoClose: false,
      withCloseButton: false,
      title: `Refreshing ${enabled.length} source${enabled.length === 1 ? '' : 's'}…`,
      message: 'Fetching in parallel.',
    });
    const { inserted: totalInserted, updated: totalUpdated, failures } = await refreshAllSources(configs);
    notifications.update({
      id,
      loading: false,
      autoClose: 4000,
      withCloseButton: true,
      color: failures > 0 ? 'yellow' : 'teal',
      icon: <IconCheck size={18} />,
      title: 'Refresh complete',
      message: `${totalInserted} new · ${totalUpdated} updated${
        failures > 0 ? ` · ${failures} source(s) failed` : ''
      }`,
    });
  }

  return (
    <Container size="md" px={0}>
      <PageHeader
        title="Sources"
        description="Configure where job postings come from. Each refresh pulls and dedupes by (source, sourceId)."
        actions={
          <Group gap="xs">
            {configs.length > 0 ? (
              <Button variant="default" onClick={handleRefreshAll}>
                Refresh all
              </Button>
            ) : null}
            <Button leftSection={<IconPlus size={16} stroke={1.6} />} onClick={open}>
              Add source
            </Button>
          </Group>
        }
      />

      {configs.length === 0 ? (
        <EmptyState
          icon={IconSearch}
          title="No sources yet"
          description="Greenhouse, Lever, RemoteOK, and We Work Remotely are supported. Add a source to start pulling jobs."
          primaryAction={{ href: '#', label: 'Add source' }}
        />
      ) : (
        <Stack gap="md">
          {configs.map((config) => (
            <SourceConfigRow
              key={config.id}
              config={config}
              onRefresh={handleRefresh}
              onRemove={handleRemove}
              onToggle={handleToggle}
              busy={busyId === config.id}
            />
          ))}
        </Stack>
      )}

      <Modal opened={opened} onClose={close} title="Add a source" size="md">
        <AddSourceForm onAdd={handleAdd} onCancel={close} />
      </Modal>

      <Paper p="md" withBorder mt="xl" bg="var(--mantine-color-gray-light)">
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            What gets fetched
          </Text>
          <Text size="xs" c="dimmed">
            Server route handlers (`/api/sources/[id]`) call each board&apos;s public API and
            return a normalized list. Jobs are deduped on `(source, sourceId)` and written
            through your storage adapter. Existing status, fit score, and notes are
            preserved on re-ingest.
          </Text>
        </Stack>
      </Paper>
    </Container>
  );
}
