'use client';

import { Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconDownload,
  IconExclamationCircle,
  IconUpload,
} from '@tabler/icons-react';
import { useRef, useState } from 'react';

import { adapter } from '@/lib/storage';
import { SnapshotSchema, type ISnapshot } from '@/lib/storage/types/ISnapshot';

import type { IDataPortabilityProps } from './types/IDataPortabilityProps';

export function DataPortability(_props: IDataPortabilityProps) {
  const profile = adapter.useProfile();
  const settings = adapter.useSettings();
  const jobs = adapter.useJobs();
  const applications = adapter.useApplications();
  const artifacts = adapter.useArtifacts();

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  function handleExport() {
    const settingsForExport = settings
      ? {
          aiModel: settings.aiModel,
          aiMaxTokens: settings.aiMaxTokens,
          defaultTemplateId: settings.defaultTemplateId,
          sourceConfigs: settings.sourceConfigs,
        }
      : undefined;
    const snapshot: ISnapshot = {
      version: 1,
      exportedAt: Math.floor(Date.now() / 1000),
      profile,
      settings: settingsForExport,
      jobs: jobs ?? [],
      applications: applications ?? [],
      artifacts: artifacts ?? [],
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `next-job-spy-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notifications.show({
      color: 'teal',
      icon: <IconCheck size={18} />,
      title: 'Exported',
      message: 'API key not included — set it again on import.',
    });
  }

  async function handleImport(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = SnapshotSchema.parse(JSON.parse(text));
      if (parsed.profile) await adapter.saveProfile(parsed.profile);
      if (parsed.settings) await adapter.saveSettings(parsed.settings);
      if (parsed.jobs.length > 0) await adapter.upsertJobs(parsed.jobs);
      for (const app of parsed.applications) {
        await adapter.upsertApplication(app);
      }
      for (const artifact of parsed.artifacts) {
        await adapter.saveArtifact(artifact);
      }
      notifications.show({
        color: 'teal',
        icon: <IconCheck size={18} />,
        title: 'Imported',
        message: `Profile, ${parsed.jobs.length} jobs, ${parsed.artifacts.length} artifacts.`,
      });
    } catch (err) {
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Import failed',
        message: err instanceof Error ? err.message : 'Invalid snapshot file',
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <Paper p="lg" withBorder>
      <Stack gap="sm">
        <Stack gap={2}>
          <Title order={4} fw={600}>
            Export · Import
          </Title>
          <Text size="sm" c="dimmed">
            Download a JSON snapshot of everything (except your API key) for backup or
            cross-device migration. Importing merges into the current store.
          </Text>
        </Stack>
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconDownload size={16} stroke={1.6} />}
            onClick={handleExport}
            disabled={busy}
          >
            Export snapshot
          </Button>
          <Button
            variant="default"
            leftSection={<IconUpload size={16} stroke={1.6} />}
            onClick={() => fileRef.current?.click()}
            loading={busy}
          >
            Import snapshot
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) void handleImport(file);
            }}
          />
        </Group>
      </Stack>
    </Paper>
  );
}
