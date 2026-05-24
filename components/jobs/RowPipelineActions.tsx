'use client';

import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowBigUpLine,
  IconCheck,
  IconExclamationCircle,
  IconSparkles,
} from '@tabler/icons-react';
import { useState } from 'react';

import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import { useAutoTuneGate } from '@/lib/screening/scoring/useAutoTuneGate';
import { adapter } from '@/lib/storage';
import { EPipelineStatus } from '@/lib/storage/types/EPipelineStatus';
import { EScreenStage } from '@/lib/storage/types/EScreenStage';
import type { IJob } from '@/lib/storage/types/IJob';
import {
  bumpJobPriorityAction,
  getJobQueuePositionAction,
  promoteScreenedOutJobAction,
} from '@/lib/storage/local/actions/screening';

interface IRowPipelineActionsProps {
  job: IJob;
}

const QUEUE_STATES = new Set<EPipelineStatus>([
  EPipelineStatus.Scraped,
  EPipelineStatus.EmbeddingQueued,
  EPipelineStatus.EmbeddingDone,
  EPipelineStatus.LocalQueued,
]);

/**
 * Two pipeline-stage actions a user can take on a single row:
 *
 *   "Move up" bumps priorityBumpedAt so the worker for the current
 *   stage picks this row up next, then carries that priority through
 *   the remaining stages.
 *
 *   "Score now" jumps the row past whatever stages remain and sends
 *   it to Claude immediately. For a row the local screen already
 *   dropped, a confirmation prompt surfaces the local model's reason
 *   so the override is an informed one (matches the design intent: the
 *   cascade is for bulk decisions; one specific job the user asked
 *   about deserves a different answer).
 */
export function RowPipelineActions({ job }: IRowPipelineActionsProps) {
  const profile = adapter.useProfile();
  const gate = useAutoTuneGate();
  const [busy, setBusy] = useState<'bump' | 'score' | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const status = job.pipelineStatus ?? EPipelineStatus.Scraped;
  const isScored = status === EPipelineStatus.Scored;
  const isExpired = status === EPipelineStatus.Expired;
  const canBump = QUEUE_STATES.has(status);
  const canScore = !isScored && !isExpired && typeof job.id === 'number';
  const wasScreenedOut = status === EPipelineStatus.ScreenedOut;
  // While auto-tune is learning, hold back Claude calls. The
  // cascade isn't trusted enough yet to spend tokens on. gate=null
  // means hook hasn't loaded yet; treat as open to avoid blocking on
  // first render.
  const scoringPaused = gate !== null && !gate.isSettled;

  async function handleBump() {
    if (typeof job.id !== 'number') return;
    setBusy('bump');
    try {
      await bumpJobPriorityAction(job.id);
      const position = await getJobQueuePositionAction(job.id);
      notifications.show({
        color: 'teal',
        icon: <IconCheck size={18} />,
        title: 'Moved up in line',
        message:
          position >= 0
            ? `Now ${position === 0 ? 'next' : `${position} job${position === 1 ? '' : 's'} ahead`} in the queue.`
            : 'Priority bumped.',
      });
    } catch (err) {
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Could not bump priority',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function runScoring() {
    if (typeof job.id !== 'number' || !profile) return;
    setBusy('score');
    const notifId = notifications.show({
      loading: true,
      autoClose: false,
      withCloseButton: false,
      title: 'Scoring this job...',
      message: 'Sending to Claude with your profile.',
    });
    try {
      if (wasScreenedOut) {
        await promoteScreenedOutJobAction(job.id);
      }
      const res = await fetch('/api/ai/rank', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profile,
          jobs: [
            {
              id: String(job.id),
              title: job.title,
              company: job.company,
              location: job.location,
              description: job.descriptionMd?.slice(0, 4000),
            },
          ],
          model: EAnthropicModel.Haiku45,
        }),
      });
      const data = (await res.json()) as {
        results?: { id: string; fitScore: number; fitNotes: string }[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || `Score-now failed (${res.status})`);
      const row = data.results?.[0];
      if (!row) throw new Error('Claude returned no result row.');
      await adapter.updateJobFit(job.id, row.fitScore, row.fitNotes);
      notifications.update({
        id: notifId,
        loading: false,
        autoClose: 5000,
        withCloseButton: true,
        color: 'teal',
        icon: <IconCheck size={18} />,
        title: 'Scored',
        message: `Fit ${Math.round(row.fitScore)} / 100.`,
      });
    } catch (err) {
      notifications.update({
        id: notifId,
        loading: false,
        autoClose: 5000,
        withCloseButton: true,
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Could not score',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleScoreClick() {
    if (wasScreenedOut) {
      setOverrideOpen(true);
      return;
    }
    await runScoring();
  }

  return (
    <>
      {canBump ? (
        <Tooltip label="Move ahead in line" withArrow>
          <ActionIcon
            variant="default"
            aria-label="Move ahead in line"
            onClick={() => void handleBump()}
            disabled={busy !== null}
          >
            <IconArrowBigUpLine size={16} stroke={1.6} />
          </ActionIcon>
        </Tooltip>
      ) : null}

      {canScore && profile ? (
        <Tooltip
          label={
            scoringPaused
              ? `Claude scoring is paused while auto-tune is still learning the embedding threshold (${Math.round((gate?.confidence ?? 0) * 100)}% confident). Turn off auto-tune in Settings to score manually.`
              : 'Score now'
          }
          withArrow
          multiline
          w={280}
        >
          <ActionIcon
            variant="default"
            aria-label="Score now"
            onClick={() => void handleScoreClick()}
            disabled={busy !== null || scoringPaused}
            loading={busy === 'score'}
          >
            <IconSparkles size={16} stroke={1.6} />
          </ActionIcon>
        </Tooltip>
      ) : null}

      <Modal
        opened={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        title="Score this anyway?"
        size="md"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            The {job.screenedOutBy === EScreenStage.Local ? 'local screen' : 'embedding screen'}
            {' '}flagged this as a mismatch.
          </Text>
          {job.screenReason ? (
            <Text size="sm" c="dimmed" fs="italic">
              Reason: {job.screenReason}
            </Text>
          ) : null}
          <Text size="sm">Score it anyway with Claude?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOverrideOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setOverrideOpen(false);
                void runScoring();
              }}
              loading={busy === 'score'}
            >
              Score anyway
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
