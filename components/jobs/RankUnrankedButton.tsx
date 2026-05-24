'use client';

import { Button, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconExclamationCircle,
  IconWand,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

import { isProfileMeaningful } from '@/lib/profile/isProfileMeaningful';
import { useAutoTuneGate } from '@/lib/screening/scoring/useAutoTuneGate';
import { adapter } from '@/lib/storage';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import { EPipelineStatus } from '@/lib/storage/types/EPipelineStatus';
import type { IJob } from '@/lib/storage/types/IJob';

import type { IRankUnrankedButtonProps } from './types/IRankUnrankedButtonProps';

const BATCH_SIZE = 10;

interface IRankResultRow {
  id: string;
  fitScore: number;
  fitNotes: string;
}

interface IRankResponse {
  results: IRankResultRow[];
  error?: string;
}

async function rankBatch(profile: unknown, batch: IJob[]): Promise<IRankResultRow[]> {
  const res = await fetch('/api/ai/rank', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      profile,
      jobs: batch.map((j) => ({
        id: String(j.id),
        title: j.title,
        company: j.company,
        location: j.location,
        descriptionMd: j.descriptionMd?.slice(0, 4000),
      })),
      model: EAnthropicModel.Haiku45,
    }),
  });
  const data = (await res.json()) as IRankResponse;
  if (!res.ok) {
    throw new Error(data.error || `Ranking failed (${res.status})`);
  }
  return data.results;
}

export function RankUnrankedButton({ jobs }: IRankUnrankedButtonProps) {
  const profile = adapter.useProfile();
  const gate = useAutoTuneGate();
  const [running, setRunning] = useState(false);
  const scoringPaused = gate !== null && !gate.isSettled;

  // Only rank jobs that have passed the upstream cascade stages. A job
  // still in screening (or one the cascade dropped) is not a candidate
  // for Claude scoring; respecting the cascade keeps the cost story
  // honest. Jobs with an undefined pipelineStatus fall through as
  // "ready" so legacy rows (pre-cascade) still get caught.
  const unranked = jobs.filter((j) => {
    if (typeof j.fitScore === 'number') return false;
    if (typeof j.id !== 'number') return false;
    const status = j.pipelineStatus ?? EPipelineStatus.LocalDone;
    return status === EPipelineStatus.LocalDone;
  });
  const count = unranked.length;
  const profileReady = isProfileMeaningful(profile);

  if (count === 0) return null;

  if (!profileReady) {
    return (
      <Tooltip
        label="Fill in your profile (at least a few skills or one work history entry) to enable ranking."
        withArrow
        multiline
        w={260}
      >
        <Button
          component={Link}
          href="/profile"
          variant="default"
          size="xs"
          leftSection={<IconWand size={14} stroke={1.6} />}
        >
          {count} unranked · Build profile to rank
        </Button>
      </Tooltip>
    );
  }

  async function handleRank() {
    if (!profile) return;
    setRunning(true);
    const notifId = notifications.show({
      loading: true,
      autoClose: false,
      withCloseButton: false,
      title: `Ranking ${count} jobs…`,
      message: `Batches of ${BATCH_SIZE}. Each one runs against your profile via Haiku.`,
    });

    let ranked = 0;
    let failed = 0;
    try {
      for (let i = 0; i < unranked.length; i += BATCH_SIZE) {
        const batch = unranked.slice(i, i + BATCH_SIZE);
        try {
          const results = await rankBatch(profile, batch);
          const byId = new Map(results.map((r) => [r.id, r]));
          for (const job of batch) {
            const result = byId.get(String(job.id));
            if (!result || typeof job.id !== 'number') continue;
            await adapter.updateJobFit(job.id, result.fitScore, result.fitNotes);
            ranked += 1;
          }
        } catch (err) {
          failed += batch.length;
          // Don't bail entirely — keep ranking the remaining batches.
          console.error('rank batch failed', err);
        }
      }
    } finally {
      setRunning(false);
    }

    notifications.update({
      id: notifId,
      loading: false,
      autoClose: 5000,
      withCloseButton: true,
      color: failed > 0 ? 'yellow' : 'teal',
      icon:
        failed > 0 ? <IconExclamationCircle size={18} /> : <IconCheck size={18} />,
      title: 'Ranking complete',
      message:
        failed > 0
          ? `${ranked} ranked · ${failed} failed (likely rate limit — try again later)`
          : `${ranked} jobs ranked. Sort or filter by fit score to see the best matches.`,
    });
  }

  if (scoringPaused) {
    return (
      <Tooltip
        label={`Claude scoring is paused while auto-tune learns the embedding threshold (${Math.round((gate?.confidence ?? 0) * 100)}% confident). Turn off auto-tune in Settings to rank manually.`}
        withArrow
        multiline
        w={280}
      >
        <Button
          variant="light"
          size="xs"
          leftSection={<IconWand size={14} stroke={1.6} />}
          disabled
        >
          {count} unranked · auto-tune learning
        </Button>
      </Tooltip>
    );
  }

  return (
    <Button
      onClick={handleRank}
      loading={running}
      variant="light"
      size="xs"
      leftSection={<IconWand size={14} stroke={1.6} />}
    >
      {running ? 'Ranking…' : `Rank ${count} unranked`}
    </Button>
  );
}
