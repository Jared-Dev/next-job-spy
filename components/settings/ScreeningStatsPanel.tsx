'use client';

import {
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconExclamationCircle,
  IconRefresh,
  IconReload,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { adapter } from '@/lib/storage';
import { EScreenStage } from '@/lib/storage/types/EScreenStage';
import {
  getErroredJobCountAction,
  getScreeningStatsAction,
  resetNonClaudeScreeningAction,
  retryErroredJobsAction,
  type IScreeningStats,
  type IStageStats,
} from '@/lib/storage/local/actions/screening';

import { ScreeningAuditModal } from './ScreeningAuditModal';

/**
 * Settled-mode boundary. Mirrored from the server module since the
 * panel does not pull server-only code into the client bundle. Kept
 * as a constant (not a setting) because the threshold has no
 * intuitive knob the user would tune.
 */
const AUTO_TUNE_SETTLED_CONFIDENCE = 0.9;

/**
 * Live auto-tune state. Updates with the rest of the stats on the
 * 3-second poll while there's pending work; otherwise refreshes on
 * the regular load triggers. The threshold sparkline reads the last
 * few entries from thresholdHistory so the user can see convergence
 * (or drift) at a glance.
 */
function AutoTuneSummary({
  autoTune,
  minVerdicts,
}: {
  autoTune: NonNullable<IScreeningStats['autoTune']>;
  minVerdicts: number;
}) {
  const last = autoTune.thresholdHistory.at(-1);
  const recent = autoTune.thresholdHistory.slice(-5);
  const stabilityPct = Math.round(autoTune.stabilityConfidence * 100);
  const samplePct = Math.round(autoTune.sampleWeight * 100);
  const combinedPct = Math.round(autoTune.confidence * 100);
  const isSettled = autoTune.confidence >= AUTO_TUNE_SETTLED_CONFIDENCE;
  const modeColor = isSettled ? 'teal' : 'yellow';
  const modeLabel = isSettled ? 'Settled' : 'Active learning';

  // Diagnose what's keeping the system out of settled mode so the
  // user knows what to wait for. Sample-count floor first (most
  // common cold-start blocker), then threshold stability.
  let blocker: string | null = null;
  if (!isSettled) {
    if (autoTune.sampleWeight < 1) {
      const need = Math.max(0, minVerdicts - autoTune.verdictCount);
      blocker = `${need} more verdict${need === 1 ? '' : 's'} needed to reach the sample-size floor (${minVerdicts}).`;
    } else if (autoTune.stabilityConfidence < AUTO_TUNE_SETTLED_CONFIDENCE) {
      blocker =
        'Threshold still adjusting between recomputes; will settle once the last few values are within ~0.01 of each other.';
    }
  }

  return (
    <Paper p="sm" withBorder bg="var(--mantine-color-indigo-light)">
      <Stack gap={4}>
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Group gap={6} wrap="nowrap">
            <Text size="xs" fw={600} c="indigo" tt="uppercase">
              Auto-tune
            </Text>
            <Badge size="xs" variant="filled" color={modeColor}>
              {modeLabel}
            </Badge>
          </Group>
          <Group gap="lg" wrap="wrap">
            <Stat label="Verdicts" value={String(autoTune.verdictCount)} />
            <Stat
              label="Threshold"
              value={last !== undefined ? last.toFixed(3) : 'n/a'}
            />
            <Stat label="Batch size" value={String(autoTune.lastBatchSize)} />
          </Group>
        </Group>
        <Group gap={6} wrap="wrap">
          <Tooltip
            label="How tightly the last few recomputed thresholds cluster (max delta of last 3, mapped to [0, 1]). High on small samples that haven't moved the threshold yet, so don't read this alone."
            withArrow
            multiline
            w={280}
            position="top"
          >
            <Badge size="xs" variant="light" color="gray">
              Stability {stabilityPct}%
            </Badge>
          </Tooltip>
          <Tooltip
            label="Fraction of the sample-size floor reached. Linear from 0 verdicts to the configured min."
            withArrow
            multiline
            w={280}
            position="top"
          >
            <Badge size="xs" variant="light" color="gray">
              Sample {samplePct}%
            </Badge>
          </Tooltip>
          <Tooltip
            label="Combined = stability * sample. Drives batch size."
            withArrow
            multiline
            w={280}
            position="top"
          >
            <Badge size="xs" variant="light" color="gray">
              Combined {combinedPct}%
            </Badge>
          </Tooltip>
        </Group>
        {blocker ? (
          <Text size="xs" c="dimmed">
            {blocker}
          </Text>
        ) : null}
        {recent.length > 0 ? (
          <Text size="xs" c="dimmed">
            Recent thresholds:{' '}
            <Text component="span" ff="monospace">
              {recent.map((t) => t.toFixed(3)).join(' -> ')}
            </Text>
          </Text>
        ) : (
          <Text size="xs" c="dimmed">
            Collecting first verdicts. Threshold stays at 0 (everything
            passes embedding) until the first reject signal arrives.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

/**
 * Confidence buckets borrowed from A/B-test dashboard idiom. Numbers
 * appear from day one so the user sees signal early, but their
 * certainty is visually qualified by sample size.
 */
function confidenceBadge(n: number) {
  if (n >= 100) {
    return (
      <Badge size="xs" color="teal" variant="light">
        n={n} · high
      </Badge>
    );
  }
  if (n >= 30) {
    return (
      <Badge size="xs" color="blue" variant="light">
        n={n} · medium
      </Badge>
    );
  }
  return (
    <Badge size="xs" color="gray" variant="light">
      n={n} · low confidence
    </Badge>
  );
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

interface IStageRowProps {
  title: string;
  description: string;
  stats: IStageStats;
  processedLabel: string;
  notRunNote: string;
  pending?: number;
  auditLabel: string;
  extra?: React.ReactNode;
  onAudit: () => void;
}

function StageRow({
  title,
  description,
  stats,
  processedLabel,
  notRunNote,
  pending,
  auditLabel,
  extra,
  onAudit,
}: IStageRowProps) {
  const bypassedCount = stats.reached - stats.actuallyProcessed;
  const isFullyBypassed = stats.reached > 0 && stats.actuallyProcessed === 0;
  return (
    <Paper p="md" withBorder>
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text fw={600} size="sm">
              {title}
            </Text>
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          </div>
          <Button
            size="xs"
            variant="light"
            onClick={onAudit}
            disabled={stats.dropped === 0}
          >
            {auditLabel}
          </Button>
        </Group>

        {isFullyBypassed ? (
          <Paper p="sm" withBorder bg="var(--mantine-color-yellow-light)">
            <Text size="xs">
              {notRunNote} The {stats.reached} jobs counted as &quot;reached&quot;
              were advanced past this stage without it actually running, so
              the filter rate below would be misleading.
            </Text>
          </Paper>
        ) : null}

        <Group gap="lg" wrap="wrap">
          {pending !== undefined ? (
            <Stat
              label="Pending"
              value={String(pending)}
              tooltip="Jobs still waiting for this stage to run on them. They are not lost; they will be processed on the next scan."
            />
          ) : null}
          <Stat label="Reached" value={String(stats.reached)} />
          <Stat
            label={processedLabel}
            value={String(stats.actuallyProcessed)}
            tooltip="How many jobs this stage actually judged. When less than 'reached', the rest were bypassed (stage was toggled off when they came through)."
          />
          <Stat label="Dropped here" value={String(stats.dropped)} />
          <Stat
            label="Filter rate"
            value={
              stats.actuallyProcessed === 0 ? 'n/a' : pct(stats.filterRate)
            }
            tooltip="dropped / actuallyProcessed. Shown as n/a when nothing was processed so a bypassed stage does not appear as a 0% filter rate."
          />
        </Group>

        {bypassedCount > 0 && !isFullyBypassed ? (
          <Text size="xs" c="dimmed">
            {bypassedCount} of {stats.reached} bypassed this stage (toggle
            was off when they came through).
          </Text>
        ) : null}

        {extra}

        {stats.audit.total > 0 ? (
          <Group gap="xs" wrap="wrap">
            <Text size="xs" c="dimmed">
              Audit:
            </Text>
            <Text size="xs">
              {pct(stats.audit.falseNegativeRate)} false-negative rate
            </Text>
            {confidenceBadge(stats.audit.total)}
            <Text size="xs" c="dimmed">
              ({stats.audit.correctlyFiltered} correct ·{' '}
              {stats.audit.shouldHavePassed} should have passed ·{' '}
              {stats.audit.borderline} borderline)
            </Text>
          </Group>
        ) : (
          <Text size="xs" c="dimmed">
            No audit data yet. Run a spot-check once the stage has dropped some
            jobs.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

function Stat({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip?: string;
}) {
  const stat = (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={600} size="sm">
        {value}
      </Text>
    </Stack>
  );
  if (tooltip) {
    return (
      <Tooltip label={tooltip} withArrow position="top" w={260} multiline>
        {stat}
      </Tooltip>
    );
  }
  return stat;
}

export function ScreeningStatsPanel() {
  const [stats, setStats] = useState<IScreeningStats | null>(null);
  const [auditStage, setAuditStage] = useState<EScreenStage | null>(null);
  const [applyingThreshold, setApplyingThreshold] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  // Errored count is a separate fetch so we can keep the button
  // visible (and accurate) even when the rest of the pipeline is
  // idle; it's not part of IScreeningStats because the audit modal
  // shouldn't have to pull all stats just for the count.
  const [erroredCount, setErroredCount] = useState(0);
  const [retrying, setRetrying] = useState(false);

  async function load() {
    const [fresh, errored] = await Promise.all([
      getScreeningStatsAction(),
      getErroredJobCountAction(),
    ]);
    setStats(fresh);
    setErroredCount(errored);
  }

  useEffect(() => {
    // Initial load is a synchronization with the server, which is
    // exactly what effects are for; the lint rule is conservative
    // about any setState inside an effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  // Live polling while the cascade has pending work OR there are
  // errored jobs (so the retry button's count updates as the user
  // retries and verdicts come in). Stops once both are clear so an
  // idle panel doesn't poll forever.
  const hasPendingWork =
    (stats?.embedding.pending ?? 0) > 0 || (stats?.local.pending ?? 0) > 0;
  const shouldPoll = hasPendingWork || erroredCount > 0;
  useEffect(() => {
    if (!shouldPoll) return;
    let cancelled = false;
    const id = setInterval(() => {
      void Promise.all([
        getScreeningStatsAction(),
        getErroredJobCountAction(),
      ]).then(([fresh, errored]) => {
        if (cancelled) return;
        setStats(fresh);
        setErroredCount(errored);
      });
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [shouldPoll]);

  async function runRetryErrored() {
    setRetrying(true);
    try {
      const result = await retryErroredJobsAction();
      notifications.show({
        color: 'teal',
        icon: <IconCheck size={18} />,
        title: 'Errored jobs requeued',
        message: `${result.retried} job${result.retried === 1 ? '' : 's'} back in the local queue. A healthy worker will pick them up.`,
      });
      void load();
    } catch (err) {
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Retry failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setRetrying(false);
    }
  }

  async function runReset() {
    setResetting(true);
    try {
      const result = await resetNonClaudeScreeningAction();
      notifications.show({
        color: 'teal',
        icon: <IconCheck size={18} />,
        title: 'Screening reset',
        message: `${result.reset} job${result.reset === 1 ? '' : 's'} put back at the start of the cascade. The embedding screen will pick them up on the next scan.`,
      });
      setResetOpen(false);
      void load();
    } catch (err) {
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Reset failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setResetting(false);
    }
  }

  async function applySuggested() {
    if (!stats || stats.suggestedEmbeddingThreshold == null) return;
    setApplyingThreshold(true);
    try {
      await adapter.saveSettings({
        screeningEmbeddingThreshold: stats.suggestedEmbeddingThreshold,
      });
      notifications.show({
        color: 'teal',
        title: 'Threshold updated',
        message: `Embedding threshold set to ${stats.suggestedEmbeddingThreshold.toFixed(2)}. Future jobs will use this value.`,
      });
      void load();
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Could not apply',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setApplyingThreshold(false);
    }
  }

  if (!stats) {
    return (
      <Paper p="sm" withBorder bg="var(--mantine-color-gray-light)">
        <Text size="xs" c="dimmed">
          Loading screening stats...
        </Text>
      </Paper>
    );
  }

  const totalProcessed = stats.embedding.reached;
  if (totalProcessed === 0) {
    return (
      <Paper p="sm" withBorder bg="var(--mantine-color-gray-light)">
        <Text size="xs" c="dimmed">
          Screening stats will appear here once the pipeline has processed some
          jobs. Stages, filter rates, false-negative audits, and a periodic
          spot-check all live in this panel.
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap="sm">
      {stats.autoTune ? (
        <AutoTuneSummary
          autoTune={stats.autoTune}
          minVerdicts={stats.autoTuneMinVerdicts}
        />
      ) : null}

      <Group justify="space-between" align="center">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase">
          Screening stats
        </Text>
        <Group gap="xs">
          {erroredCount > 0 ? (
            <Tooltip
              label="Re-queue every job currently parked in Error state back into the local queue. Use this after dropping the worker parallelism (or otherwise fixing the cause of the errors)."
              withArrow
              w={280}
              multiline
              position="top"
            >
              <Button
                size="xs"
                variant="subtle"
                color="orange"
                leftSection={<IconReload size={14} stroke={1.6} />}
                onClick={() => void runRetryErrored()}
                loading={retrying}
                disabled={retrying}
              >
                Retry {erroredCount} errored
              </Button>
            </Tooltip>
          ) : null}
          <Button
            size="xs"
            variant="subtle"
            color="red"
            leftSection={<IconRefresh size={14} stroke={1.6} />}
            onClick={() => setResetOpen(true)}
          >
            Reset & re-screen
          </Button>
        </Group>
      </Group>

      <StageRow
        title="Embedding screen"
        description="Server-side topical similarity vs your profile."
        stats={stats.embedding}
        processedLabel="Embedded"
        pending={stats.embedding.pending}
        auditLabel="Audit with Local LLM"
        notRunNote="The embedding screen never ran on these jobs (likely turned off when they were ingested, or the screen was first enabled after they came through)."
        extra={
          <Stack gap="xs">
            {stats.embedding.avgScore !== null ? (
              <Group gap="xs">
                <Text size="xs" c="dimmed">
                  Avg cosine:
                </Text>
                <Text size="xs" fw={600}>
                  {stats.embedding.avgScore.toFixed(3)}
                </Text>
                <Text size="xs" c="dimmed">
                  (calibrate threshold against this)
                </Text>
              </Group>
            ) : null}
            {stats.suggestedEmbeddingThreshold !== null ? (
              <Paper p="sm" withBorder bg="var(--mantine-color-blue-light)">
                <Group justify="space-between" wrap="wrap" gap="xs">
                  <Text size="xs">
                    Audit suggests threshold{' '}
                    <Text component="span" fw={600}>
                      {stats.suggestedEmbeddingThreshold.toFixed(2)}
                    </Text>
                    . Lower values let more borderline jobs through.
                  </Text>
                  <Button
                    size="xs"
                    variant="light"
                    loading={applyingThreshold}
                    onClick={() => void applySuggested()}
                  >
                    Apply
                  </Button>
                </Group>
              </Paper>
            ) : null}
          </Stack>
        }
        onAudit={() => setAuditStage(EScreenStage.Embedding)}
      />

      <StageRow
        title="Local LLM screen"
        description="Browser Web Worker reasoning gate."
        stats={stats.local}
        processedLabel="Judged"
        pending={stats.local.pending}
        auditLabel="Audit with Claude"
        notRunNote="The local screen never ran on these jobs (toggled off when they were ingested, or the worker has not picked them up yet). Open /jobs in a tab to drain the local queue."
        extra={
          <Tooltip
            label="Jobs the local stage dropped that the embedding screen had already passed. If this is near zero, the local stage isn't catching anything the embedding screen wouldn't."
            withArrow
            w={280}
            multiline
            position="top"
          >
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                Marginal value:
              </Text>
              <Text size="xs" fw={600}>
                {stats.local.marginalDropped} dropped beyond the embedding
                screen
              </Text>
            </Group>
          </Tooltip>
        }
        onAudit={() => setAuditStage(EScreenStage.Local)}
      />

      <Paper p="md" withBorder>
        <Group justify="space-between" wrap="wrap" gap="md">
          <div>
            <Text fw={600} size="sm">
              Claude scoring
            </Text>
            <Text size="xs" c="dimmed">
              View-driven; only counts jobs you scrolled into view.
            </Text>
          </div>
          <Group gap="lg">
            <Stat label="Scored" value={String(stats.scored.count)} />
            <Stat
              label="Avg fit score"
              value={
                stats.scored.avgFitScore === null
                  ? 'n/a'
                  : String(stats.scored.avgFitScore)
              }
            />
          </Group>
        </Group>
      </Paper>

      {stats.expired > 0 ? (
        <Paper p="sm" withBorder bg="var(--mantine-color-gray-light)">
          <Text size="xs">
            <Text component="span" fw={600}>
              {stats.expired}
            </Text>{' '}
            posting{stats.expired === 1 ? '' : 's'} expired (404 / 410 at
            their original URL) and were skipped before scoring.
          </Text>
        </Paper>
      ) : null}

      <Divider />
      <Text size="xs" c="dimmed">
        Filter rates and counts update live. Each Claude audit samples 10
        dropped jobs, runs them through Claude, and verdicts them based on
        the fit score Claude returns. Jobs Claude rates {'>='} 30 get
        promoted back into the list with their new fit score; the rest stay
        dropped. After enough audits flag &quot;should have passed&quot; on
        the embedding stage, a threshold suggestion appears above.
      </Text>

      {auditStage !== null ? (
        <ScreeningAuditModal
          stage={auditStage}
          opened
          onClose={() => setAuditStage(null)}
          onFinished={() => void load()}
        />
      ) : null}

      <Modal
        opened={resetOpen}
        onClose={() => (resetting ? null : setResetOpen(false))}
        title="Reset and re-screen?"
        size="md"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            This puts every job that Claude has not already scored back at the
            start of the cascade. Cached embeddings and prior screen verdicts
            are cleared so the embedding screen and local screen run again
            from scratch.
          </Text>
          <Text size="sm">
            Jobs Claude has already scored are <strong>not</strong> touched;
            their fit scores stay put.
          </Text>
          <Text size="xs" c="dimmed">
            After the reset, the next scan will drain the embedding queue and
            (if the local screen is on) flow them into the local worker
            automatically.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setResetOpen(false)}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => void runReset()}
              loading={resetting}
            >
              Reset and re-screen
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
