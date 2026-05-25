'use client';

import {
  Alert,
  Badge,
  Button,
  Group,
  List,
  Modal,
  Paper,
  Progress,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCheck,
  IconCircleCheck,
  IconCpu,
  IconExclamationCircle,
  IconSparkles,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import { isProfileMeaningful } from '@/lib/profile/isProfileMeaningful';
import { adapter } from '@/lib/storage';
import { EAuditVerdict } from '@/lib/storage/types/EAuditVerdict';
import { EScreenStage } from '@/lib/storage/types/EScreenStage';
import {
  getAuditBatchProgressAction,
  getAuditSampleAction,
  getPendingEmbeddingAuditCountAction,
  promoteEmbeddingDropsForLocalAuditAction,
  recordAuditVerdictAction,
  type IAuditBatchProgress,
  type IAuditSampleJob,
} from '@/lib/storage/local/actions/screening';

const CLAUDE_SAMPLE_SIZE = 10;
const LOCAL_SAMPLE_DEFAULT = 50;
const LOCAL_SAMPLE_OPTIONS = ['25', '50', '100', '200'] as const;

/**
 * Classifier for Claude's fit score -> audit verdict.
 * Used by the local-stage audit (Claude is the next tier above local).
 */
const SHOULD_PASS_THRESHOLD = 50;
const CORRECT_THRESHOLD = 30;

function classifyFitScore(score: number): EAuditVerdict {
  if (score >= SHOULD_PASS_THRESHOLD) return EAuditVerdict.ShouldPass;
  if (score < CORRECT_THRESHOLD) return EAuditVerdict.Correct;
  return EAuditVerdict.Borderline;
}

interface IRankResultRow {
  id: string;
  fitScore: number;
  fitNotes: string;
}

interface IRankResponse {
  results?: IRankResultRow[];
  error?: string;
}

interface IDetail {
  job: IAuditSampleJob;
  fitScore: number;
  fitNotes: string;
  verdict: EAuditVerdict;
}

type TClaudePhase =
  | { kind: 'sampling' }
  | { kind: 'no_profile' }
  | { kind: 'empty' }
  | { kind: 'preview' }
  | { kind: 'running' }
  | {
      kind: 'done';
      correct: number;
      shouldPass: number;
      borderline: number;
      promoted: number;
      details: IDetail[];
    }
  | { kind: 'error'; message: string };

type TLocalPhase =
  | { kind: 'loading' }
  | { kind: 'preview'; pending: number }
  | { kind: 'running' }
  | {
      kind: 'tracking';
      promotedJobIds: number[];
      progress: IAuditBatchProgress;
    }
  | { kind: 'error'; message: string };

const BATCH_POLL_MS = 3000;

interface IScreeningAuditModalProps {
  stage: EScreenStage;
  opened: boolean;
  onClose: () => void;
  /** Called when the audit finishes / promotes; the panel re-fetches stats. */
  onFinished: () => void;
}

const STAGE_LABEL: Record<EScreenStage, string> = {
  [EScreenStage.Language]: 'language gate',
  [EScreenStage.Embedding]: 'embedding screen',
  [EScreenStage.Local]: 'local screen',
};

function verdictBadgeColor(verdict: EAuditVerdict): string {
  if (verdict === EAuditVerdict.ShouldPass) return 'red';
  if (verdict === EAuditVerdict.Borderline) return 'yellow';
  return 'teal';
}

function verdictLabel(verdict: EAuditVerdict): string {
  if (verdict === EAuditVerdict.ShouldPass) return 'Should have passed';
  if (verdict === EAuditVerdict.Borderline) return 'Borderline';
  return 'Correctly filtered';
}

export function ScreeningAuditModal({
  stage,
  opened,
  onClose,
  onFinished,
}: IScreeningAuditModalProps) {
  if (stage === EScreenStage.Embedding) {
    return (
      <EmbeddingAuditModal
        opened={opened}
        onClose={onClose}
        onFinished={onFinished}
      />
    );
  }
  return (
    <LocalAuditModal opened={opened} onClose={onClose} onFinished={onFinished} />
  );
}

/**
 * Embedding-stage audit. Tiered: sample N dropped jobs and promote
 * them back to the local queue. The local LLM verdict resolves the
 * audit asynchronously; we don't block waiting for it. Large samples
 * are practical because each local inference is "free".
 */
function EmbeddingAuditModal({
  opened,
  onClose,
  onFinished,
}: {
  opened: boolean;
  onClose: () => void;
  onFinished: () => void;
}) {
  const [phase, setPhase] = useState<TLocalPhase>({ kind: 'loading' });
  const [sampleSize, setSampleSize] = useState<string>(String(LOCAL_SAMPLE_DEFAULT));

  useEffect(() => {
    if (!opened) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase({ kind: 'loading' });
    void (async () => {
      try {
        const pending = await getPendingEmbeddingAuditCountAction();
        setPhase({ kind: 'preview', pending });
      } catch (err) {
        setPhase({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Could not load pending count',
        });
      }
    })();
  }, [opened]);

  async function runPromote() {
    setPhase({ kind: 'running' });
    try {
      const n = Number.parseInt(sampleSize, 10) || LOCAL_SAMPLE_DEFAULT;
      const result = await promoteEmbeddingDropsForLocalAuditAction(n);
      if (result.promoted === 0) {
        setPhase({
          kind: 'error',
          message: result.reason ?? 'Nothing was promoted.',
        });
        return;
      }
      // Initial snapshot: nothing resolved yet, all pending.
      setPhase({
        kind: 'tracking',
        promotedJobIds: result.promotedJobIds,
        progress: {
          total: result.promoted,
          pending: result.promoted,
          shouldPass: 0,
          correct: 0,
          errored: 0,
          resolved: [],
        },
      });
      onFinished();
    } catch (err) {
      setPhase({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Poll the audit table while the modal is in tracking phase. The
  // local LLM verdicts trickle in over time as the worker on /jobs
  // chews through the promoted sample (~5s per job for Phi).
  useEffect(() => {
    if (phase.kind !== 'tracking') return;
    const ids = phase.promotedJobIds;
    let cancelled = false;
    const tick = async () => {
      try {
        const progress = await getAuditBatchProgressAction(
          ids,
          EScreenStage.Embedding,
        );
        if (cancelled) return;
        setPhase((prev) =>
          prev.kind === 'tracking' ? { ...prev, progress } : prev,
        );
        // Bubble up so the stats panel refreshes too.
        onFinished();
      } catch {
        // Poll failure is non-fatal; next tick will catch up.
      }
    };
    void tick();
    const interval = setInterval(() => void tick(), BATCH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [phase, onFinished]);

  function close() {
    onClose();
  }

  return (
    <Modal
      opened={opened}
      onClose={() => (phase.kind === 'running' ? null : close())}
      title={<Title order={4}>Audit the embedding screen with the local LLM</Title>}
      size="lg"
      centered
    >
      {phase.kind === 'loading' ? (
        <Stack gap="md">
          <Skeleton height={20} />
          <Skeleton height={80} />
        </Stack>
      ) : null}

      {phase.kind === 'preview' ? (
        <Stack gap="md">
          <Text size="sm">
            Promotes a random sample of embedding-dropped jobs back into the
            local screen queue. The local LLM verdicts them next time it
            drains the queue; results land in screening_audit as they come
            in.
          </Text>
          <Text size="xs" c="dimmed">
            Local inference is free per call, so the sample can be large.
            Keep <code>/jobs</code> open so the worker stays draining.
          </Text>
          {phase.pending > 0 ? (
            <Alert
              icon={<IconCpu size={18} />}
              color="blue"
              variant="light"
              title={`${phase.pending} audit${phase.pending === 1 ? '' : 's'} already in flight`}
            >
              These are still being processed by the local LLM. Their
              verdicts will appear in the stats panel as they complete.
            </Alert>
          ) : null}
          <Group gap="xs" align="center">
            <Text size="sm">Sample size:</Text>
            <SegmentedControl
              size="xs"
              value={sampleSize}
              onChange={setSampleSize}
              data={LOCAL_SAMPLE_OPTIONS.map((v) => ({ value: v, label: v }))}
            />
          </Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button
              leftSection={<IconCpu size={16} stroke={1.6} />}
              onClick={() => void runPromote()}
            >
              Promote {sampleSize} for re-judgment
            </Button>
          </Group>
        </Stack>
      ) : null}

      {phase.kind === 'running' ? (
        <Stack gap="md" align="center">
          <Text size="sm">Promoting jobs back to the local queue...</Text>
          <Skeleton height={40} />
        </Stack>
      ) : null}

      {phase.kind === 'tracking' ? (
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Stack gap={0}>
              <Text size="sm" fw={600}>
                {phase.progress.pending === 0
                  ? `Audit complete: ${phase.progress.total - phase.progress.errored} verdicts in${phase.progress.errored > 0 ? ` (${phase.progress.errored} errored)` : ''}`
                  : `${phase.progress.shouldPass + phase.progress.correct + phase.progress.errored} of ${phase.progress.total} resolved`}
              </Text>
              <Text size="xs" c="dimmed">
                {phase.progress.pending === 0
                  ? 'No more verdicts coming.'
                  : 'Local LLM is working through the queue. Updates every few seconds.'}
              </Text>
            </Stack>
            <Badge
              size="lg"
              variant="light"
              color={phase.progress.pending === 0 ? 'teal' : 'indigo'}
            >
              {Math.round(
                ((phase.progress.shouldPass +
                  phase.progress.correct +
                  phase.progress.errored) /
                  Math.max(1, phase.progress.total)) *
                  100,
              )}
              %
            </Badge>
          </Group>

          <Progress
            value={
              ((phase.progress.shouldPass +
                phase.progress.correct +
                phase.progress.errored) /
                Math.max(1, phase.progress.total)) *
              100
            }
            size="md"
            radius="sm"
            animated={phase.progress.pending > 0}
            striped={phase.progress.pending > 0}
            color={phase.progress.pending === 0 ? 'teal' : 'indigo'}
          />

          <Paper p="md" withBorder>
            <Group gap="lg" wrap="wrap">
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Should have passed</Text>
                <Text fw={600} c="red">{phase.progress.shouldPass}</Text>
              </Stack>
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Correctly filtered</Text>
                <Text fw={600} c="teal">{phase.progress.correct}</Text>
              </Stack>
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Pending</Text>
                <Text fw={600}>{phase.progress.pending}</Text>
              </Stack>
              {phase.progress.errored > 0 ? (
                <Stack gap={0}>
                  <Text size="xs" c="dimmed">Errored</Text>
                  <Text fw={600} c="orange">{phase.progress.errored}</Text>
                </Stack>
              ) : null}
            </Group>
          </Paper>

          {phase.progress.resolved.length > 0 ? (
            <Stack gap={4}>
              <Text size="xs" fw={500} c="dimmed">
                Recent verdicts (most recent first)
              </Text>
              <Paper
                withBorder
                p="xs"
                style={{ maxHeight: 280, overflowY: 'auto' }}
              >
                <List size="sm" spacing={4}>
                  {phase.progress.resolved.map((r) => (
                    <List.Item
                      key={r.jobId}
                      icon={
                        r.verdict === 'should_pass' ? (
                          <IconAlertTriangle
                            size={14}
                            color="var(--mantine-color-red-6)"
                          />
                        ) : r.verdict === 'errored' ? (
                          <IconAlertTriangle
                            size={14}
                            color="var(--mantine-color-orange-6)"
                          />
                        ) : (
                          <IconCircleCheck
                            size={14}
                            color="var(--mantine-color-teal-6)"
                          />
                        )
                      }
                    >
                      <Stack gap={2}>
                        <Group gap="xs" wrap="nowrap">
                          <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
                            {r.title}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {r.company}
                          </Text>
                          <Badge
                            size="xs"
                            variant="light"
                            color={
                              r.verdict === 'should_pass'
                                ? 'red'
                                : r.verdict === 'errored'
                                  ? 'orange'
                                  : 'teal'
                            }
                          >
                            {r.verdict === 'should_pass'
                              ? 'should pass'
                              : r.verdict === 'errored'
                                ? 'errored'
                                : 'correct'}
                          </Badge>
                        </Group>
                        {r.verdict === 'errored' && r.reason ? (
                          <Text size="xs" c="orange" style={{ marginLeft: 0 }}>
                            {r.reason}
                          </Text>
                        ) : null}
                      </Stack>
                    </List.Item>
                  ))}
                </List>
              </Paper>
            </Stack>
          ) : null}

          <Text size="xs" c="dimmed">
            Keep <code>/jobs</code> open so the local worker keeps draining.
            You can close this modal; verdicts still resolve in the
            background and the screening stats panel will pick them up.
          </Text>

          <Group justify="flex-end">
            <Button onClick={close}>
              {phase.progress.pending === 0 ? 'Done' : 'Close (continues)'}
            </Button>
          </Group>
        </Stack>
      ) : null}

      {phase.kind === 'error' ? (
        <Stack gap="md">
          <Alert
            icon={<IconAlertTriangle size={18} />}
            color="red"
            title="Cannot audit yet"
          >
            {phase.message}
          </Alert>
          <Group justify="flex-end">
            <Button onClick={close}>Close</Button>
          </Group>
        </Stack>
      ) : null}
    </Modal>
  );
}

/**
 * Local-stage audit. Tiered: send a small Claude batch synchronously
 * and use Claude's fit score to verdict each row.
 */
function LocalAuditModal({
  opened,
  onClose,
  onFinished,
}: {
  opened: boolean;
  onClose: () => void;
  onFinished: () => void;
}) {
  const profile = adapter.useProfile();
  const [sample, setSample] = useState<IAuditSampleJob[] | null>(null);
  const [phase, setPhase] = useState<TClaudePhase>({ kind: 'sampling' });

  useEffect(() => {
    if (!opened) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSample(null);
    setPhase({ kind: 'sampling' });
    void (async () => {
      try {
        const fetched = await getAuditSampleAction(
          EScreenStage.Local,
          CLAUDE_SAMPLE_SIZE,
        );
        setSample(fetched);
        if (fetched.length === 0) {
          setPhase({ kind: 'empty' });
        } else if (!isProfileMeaningful(profile)) {
          setPhase({ kind: 'no_profile' });
        } else {
          setPhase({ kind: 'preview' });
        }
      } catch (err) {
        setPhase({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Could not load sample',
        });
      }
    })();
  }, [opened, profile]);

  async function runAudit() {
    if (!sample || sample.length === 0 || !profile) return;
    setPhase({ kind: 'running' });
    try {
      const res = await fetch('/api/ai/rank', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profile,
          jobs: sample.map((j) => ({
            id: String(j.id),
            title: j.title,
            company: j.company,
            location: j.location,
            description: j.descriptionMd?.slice(0, 4000),
          })),
          model: EAnthropicModel.Haiku45,
        }),
      });
      const data = (await res.json()) as IRankResponse;
      if (!res.ok) {
        throw new Error(data.error ?? `Claude audit failed (${res.status})`);
      }
      const byId = new Map((data.results ?? []).map((r) => [r.id, r]));

      const details: IDetail[] = [];
      let correct = 0;
      let shouldPass = 0;
      let borderline = 0;
      let promoted = 0;

      for (const job of sample) {
        const r = byId.get(String(job.id));
        if (!r) continue;
        const verdict = classifyFitScore(r.fitScore);
        details.push({ job, fitScore: r.fitScore, fitNotes: r.fitNotes, verdict });

        await recordAuditVerdictAction(
          job.id,
          EScreenStage.Local,
          verdict === EAuditVerdict.Pending ? EAuditVerdict.Borderline : verdict,
        );

        if (verdict === EAuditVerdict.ShouldPass) shouldPass += 1;
        else if (verdict === EAuditVerdict.Borderline) borderline += 1;
        else correct += 1;

        if (verdict !== EAuditVerdict.Correct) {
          await adapter.updateJobFit(job.id, r.fitScore, r.fitNotes);
          promoted += 1;
        }
      }

      setPhase({ kind: 'done', correct, shouldPass, borderline, promoted, details });
      onFinished();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setPhase({ kind: 'error', message });
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Audit failed',
        message,
      });
    }
  }

  function close() {
    onClose();
  }

  const isRunning = phase.kind === 'running';

  return (
    <Modal
      opened={opened}
      onClose={() => (isRunning ? null : close())}
      title={
        <Title order={4}>Audit the {STAGE_LABEL[EScreenStage.Local]} with Claude</Title>
      }
      size="lg"
      centered
    >
      {phase.kind === 'sampling' ? (
        <Stack gap="md">
          <Skeleton height={20} />
          <Skeleton height={120} />
        </Stack>
      ) : null}

      {phase.kind === 'no_profile' ? (
        <Stack gap="md">
          <Alert
            icon={<IconAlertTriangle size={18} />}
            color="yellow"
            title="Set up your profile first"
          >
            Claude needs your profile to judge whether a dropped job actually
            matches you.
          </Alert>
          <Button onClick={close}>Close</Button>
        </Stack>
      ) : null}

      {phase.kind === 'empty' ? (
        <Stack gap="md" align="center">
          <Text c="dimmed" size="sm">
            No dropped jobs to audit at this stage yet, or every drop has
            already been audited.
          </Text>
          <Button onClick={close}>Close</Button>
        </Stack>
      ) : null}

      {phase.kind === 'preview' && sample ? (
        <Stack gap="md">
          <Text size="sm">
            {sample.length} dropped job{sample.length === 1 ? '' : 's'} sampled
            at random. Sending them to Claude as a single batch.
          </Text>
          <Text size="xs" c="dimmed">
            Counts as one /api/ai/rank call on your Claude subscription. Jobs
            Claude rates {'>='} {CORRECT_THRESHOLD} are promoted back into
            the list with their fit score; the rest stay dropped.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button
              leftSection={<IconSparkles size={16} stroke={1.6} />}
              onClick={() => void runAudit()}
            >
              Run audit
            </Button>
          </Group>
        </Stack>
      ) : null}

      {phase.kind === 'running' ? (
        <Stack gap="md" align="center">
          <Text size="sm">Asking Claude to score the sample...</Text>
          <Skeleton height={60} />
        </Stack>
      ) : null}

      {phase.kind === 'done' ? (
        <Stack gap="md">
          <Paper p="md" withBorder>
            <Group gap="lg" wrap="wrap">
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Correctly filtered</Text>
                <Text fw={600}>{phase.correct}</Text>
              </Stack>
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Borderline</Text>
                <Text fw={600}>{phase.borderline}</Text>
              </Stack>
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Should have passed</Text>
                <Text fw={600} c="red">{phase.shouldPass}</Text>
              </Stack>
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Promoted back</Text>
                <Text fw={600}>{phase.promoted}</Text>
              </Stack>
            </Group>
          </Paper>

          {phase.details.length > 0 ? (
            <List size="sm" spacing={6}>
              {phase.details.map((d) => (
                <List.Item
                  key={d.job.id}
                  icon={
                    d.verdict === EAuditVerdict.Correct ? (
                      <IconCircleCheck size={14} color="var(--mantine-color-teal-6)" />
                    ) : d.verdict === EAuditVerdict.ShouldPass ? (
                      <IconAlertTriangle size={14} color="var(--mantine-color-red-6)" />
                    ) : (
                      <IconSparkles size={14} color="var(--mantine-color-yellow-6)" />
                    )
                  }
                >
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={500} style={{ flex: 1, minWidth: 0 }} truncate>
                      {d.job.title}
                    </Text>
                    <Badge size="xs" variant="light" color="gray">
                      {Math.round(d.fitScore)}
                    </Badge>
                    <Badge
                      size="xs"
                      variant="light"
                      color={verdictBadgeColor(d.verdict)}
                    >
                      {verdictLabel(d.verdict)}
                    </Badge>
                  </Group>
                </List.Item>
              ))}
            </List>
          ) : null}

          <Group justify="flex-end">
            <Button onClick={close}>
              <IconCheck size={16} style={{ marginRight: 6 }} />
              Done
            </Button>
          </Group>
        </Stack>
      ) : null}

      {phase.kind === 'error' ? (
        <Stack gap="md">
          <Alert
            icon={<IconAlertTriangle size={18} />}
            color="red"
            title="Audit failed"
          >
            {phase.message}
          </Alert>
          <Group justify="flex-end">
            <Button onClick={close}>Close</Button>
          </Group>
        </Stack>
      ) : null}
    </Modal>
  );
}
