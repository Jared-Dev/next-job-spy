'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconExclamationCircle,
  IconPrinter,
  IconSend,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import { adapter } from '@/lib/storage';
import { EApplicationStatus } from '@/lib/storage/types/EApplicationStatus';
import { EArtifactKind } from '@/lib/storage/types/EArtifactKind';
import { EJobStatus } from '@/lib/storage/types/EJobStatus';
import type { IApplication } from '@/lib/storage/types/IApplication';
import type { IArtifact } from '@/lib/storage/types/IArtifact';

import { applicationStatusMeta } from './applicationStatusMeta';
import type { IApplicationPanelProps } from './types/IApplicationPanelProps';

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** The pinned artifact, else the newest, artifacts arrive newest-first. */
function pickPrimary(list: IArtifact[]): IArtifact | undefined {
  return list.find((a) => a.pinned) ?? list[0];
}

function artifactLabel(a: IArtifact): string {
  const when = new Date(a.createdAt * 1000).toLocaleDateString();
  return a.pinned ? `${when} (pinned)` : when;
}

export function ApplicationPanel({ job }: IApplicationPanelProps) {
  const applications = adapter.useApplications();
  const artifacts = adapter.useArtifacts(job.id);
  const [busy, setBusy] = useState(false);

  const application = useMemo<IApplication | null>(
    () => applications?.find((a) => a.jobId === job.id) ?? null,
    [applications, job.id],
  );

  const resumes = useMemo(
    () => (artifacts ?? []).filter((a) => a.kind === EArtifactKind.TailoredResume),
    [artifacts],
  );
  const coverLetters = useMemo(
    () => (artifacts ?? []).filter((a) => a.kind === EArtifactKind.CoverLetter),
    [artifacts],
  );

  const linkedResume = useMemo(
    () =>
      application
        ? resumes.find((a) => a.applicationId === application.id)
        : undefined,
    [application, resumes],
  );
  const linkedCover = useMemo(
    () =>
      application
        ? coverLetters.find((a) => a.applicationId === application.id)
        : undefined,
    [application, coverLetters],
  );

  async function markApplied() {
    const jobId = job.id;
    if (typeof jobId !== 'number') return;
    setBusy(true);
    try {
      const now = nowSeconds();
      const appId = await adapter.upsertApplication({
        jobId,
        status: EApplicationStatus.Submitted,
        submittedAt: now,
        updatedAt: now,
      });
      const resume = pickPrimary(resumes);
      const cover = pickPrimary(coverLetters);
      if (resume) await adapter.saveArtifact({ ...resume, applicationId: appId });
      if (cover) await adapter.saveArtifact({ ...cover, applicationId: appId });
      await adapter.updateJobStatus(jobId, EJobStatus.Applied);
      notifications.show({
        color: 'teal',
        icon: <IconCheck size={18} />,
        title: 'Marked as applied',
        message: 'Recorded, with the resume and cover letter on file.',
      });
    } catch (err) {
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Could not record application',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(status: EApplicationStatus) {
    if (!application) return;
    await adapter.upsertApplication({ ...application, status });
  }

  async function saveNotes(notes: string) {
    if (!application || notes === (application.notes ?? '')) return;
    await adapter.upsertApplication({ ...application, notes });
  }

  async function linkArtifact(kind: EArtifactKind, artifactId: number | null) {
    if (!application) return;
    const pool = kind === EArtifactKind.TailoredResume ? resumes : coverLetters;
    for (const a of pool) {
      if (a.applicationId === application.id && a.id !== artifactId) {
        await adapter.saveArtifact({ ...a, applicationId: undefined });
      }
    }
    if (artifactId !== null) {
      const chosen = pool.find((a) => a.id === artifactId);
      if (chosen) {
        await adapter.saveArtifact({ ...chosen, applicationId: application.id });
      }
    }
  }

  if (applications === undefined) {
    return null;
  }

  if (!application) {
    return (
      <Paper p="lg" withBorder>
        <Group gap="sm" wrap="nowrap" align="center" mb="sm">
          <IconSend size={20} stroke={1.6} color="var(--mantine-color-indigo-5)" />
          <Title order={4} fw={600}>
            Application
          </Title>
        </Group>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Applied to this role? Record it,the resume and cover letter you
            generated get locked to the application, and you can track its
            status from here and the Applications page.
          </Text>
          <Group>
            <Button
              onClick={markApplied}
              loading={busy}
              leftSection={<IconSend size={16} stroke={1.6} />}
            >
              Mark as applied
            </Button>
          </Group>
        </Stack>
      </Paper>
    );
  }

  const meta = applicationStatusMeta(application.status);
  const statusData = Object.values(EApplicationStatus).map((s) => ({
    value: s,
    label: applicationStatusMeta(s).label,
  }));
  const resumeData = resumes.map((a) => ({
    value: String(a.id),
    label: artifactLabel(a),
  }));
  const coverData = coverLetters.map((a) => ({
    value: String(a.id),
    label: artifactLabel(a),
  }));

  return (
    <Paper p="lg" withBorder>
      <Group justify="space-between" wrap="nowrap" align="center" mb="sm">
        <Group gap="sm" wrap="nowrap" align="center">
          <IconSend size={20} stroke={1.6} color="var(--mantine-color-indigo-5)" />
          <Title order={4} fw={600}>
            Application
          </Title>
          <Badge size="sm" variant="light" color={meta.color}>
            {meta.label}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed">
          {application.submittedAt
            ? `Applied ${new Date(application.submittedAt * 1000).toLocaleDateString()}`
            : 'No date recorded'}
        </Text>
      </Group>

      <Stack gap="md">
        <Select
          label="Status"
          data={statusData}
          value={application.status}
          onChange={(v) => v && updateStatus(v as EApplicationStatus)}
          allowDeselect={false}
          w={220}
        />

        <Divider label="Documents sent" labelPosition="left" />

        <Group align="flex-end" wrap="nowrap" gap="xs">
          <Select
            label="Resume"
            placeholder={resumes.length ? 'Pick a version' : 'None generated yet'}
            data={resumeData}
            value={linkedResume?.id != null ? String(linkedResume.id) : null}
            onChange={(v) =>
              linkArtifact(EArtifactKind.TailoredResume, v ? Number(v) : null)
            }
            disabled={resumes.length === 0}
            clearable
            style={{ flex: 1 }}
          />
          <Tooltip label="Open print view" withArrow>
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="Open resume print view"
              disabled={!linkedResume}
              onClick={() =>
                linkedResume &&
                window.open(
                  `/resume/${linkedResume.id}/print`,
                  '_blank',
                  'noopener,noreferrer',
                )
              }
            >
              <IconPrinter size={16} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Group align="flex-end" wrap="nowrap" gap="xs">
          <Select
            label="Cover letter"
            placeholder={
              coverLetters.length ? 'Pick a version' : 'None generated yet'
            }
            data={coverData}
            value={linkedCover?.id != null ? String(linkedCover.id) : null}
            onChange={(v) =>
              linkArtifact(EArtifactKind.CoverLetter, v ? Number(v) : null)
            }
            disabled={coverLetters.length === 0}
            clearable
            style={{ flex: 1 }}
          />
          <Tooltip label="Open print view" withArrow>
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="Open cover letter print view"
              disabled={!linkedCover}
              onClick={() =>
                linkedCover &&
                window.open(
                  `/resume/${linkedCover.id}/print`,
                  '_blank',
                  'noopener,noreferrer',
                )
              }
            >
              <IconPrinter size={16} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Textarea
          key={application.id}
          label="Notes"
          placeholder="Recruiter name, referral, follow-up dates, interview notes…"
          description="Saved when you click away."
          defaultValue={application.notes ?? ''}
          onBlur={(e) => saveNotes(e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={8}
        />
      </Stack>
    </Paper>
  );
}
