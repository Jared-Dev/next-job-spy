'use client';

import { Badge, Tooltip } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCircle,
  IconCircleCheck,
  IconClockHour4,
  IconCloud,
  IconCpu,
  IconEyeOff,
  IconFilter,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';

import { EPipelineStatus } from '@/lib/storage/types/EPipelineStatus';
import { EScreenStage } from '@/lib/storage/types/EScreenStage';
import type { IJob } from '@/lib/storage/types/IJob';

interface IPipelineStatusBadgeProps {
  job: IJob;
  /**
   * True when this row is currently in flight at Claude (set by the
   * view-driven scoring pump). Overrides the visual to shimmer.
   */
  isScoring?: boolean;
  /**
   * True when the local Web Worker is processing this exact row right
   * now. Promotes the queued-for-local pulse to a shimmer so the user
   * can see which row is being judged.
   */
  isLocalScreening?: boolean;
}

interface IBadgeConfig {
  color: string;
  icon: ReactNode;
  label: string;
  /** CSS class controlling the animation idiom (pulse / shimmer / none). */
  motionClass?: string;
  /** Live-region politeness for transitions; "polite" for most. */
  ariaLabel?: string;
  /** Tooltip body explaining the stage in one line. */
  tooltip?: string;
}

function configFor(
  job: IJob,
  isScoring: boolean,
  isLocalScreening: boolean,
): IBadgeConfig | null {
  const status = job.pipelineStatus ?? EPipelineStatus.Scraped;

  if (isScoring) {
    return {
      color: 'blue',
      icon: <IconCloud size={12} stroke={1.6} />,
      label: 'Scoring',
      motionClass: 'njs-pipeline-shimmer',
      tooltip: 'Claude is scoring this row now.',
      ariaLabel: 'Claude is scoring this row',
    };
  }

  if (isLocalScreening) {
    return {
      color: 'indigo',
      icon: <IconCpu size={12} stroke={1.6} />,
      label: 'Screening',
      motionClass: 'njs-pipeline-shimmer',
      tooltip: 'The local screen is judging this row right now.',
      ariaLabel: 'Local screen is processing this row',
    };
  }

  switch (status) {
    case EPipelineStatus.Scraped:
    case EPipelineStatus.EmbeddingQueued:
      return {
        color: 'gray',
        icon: <IconClockHour4 size={12} stroke={1.6} />,
        label: 'Queued',
        motionClass: 'njs-pipeline-pulse',
        tooltip: 'Waiting for the embedding screen.',
        ariaLabel: 'Job is queued for embedding screen',
      };
    case EPipelineStatus.EmbeddingDone:
      return {
        color: 'teal',
        icon: <IconFilter size={12} stroke={1.6} />,
        label: 'Past embedding',
        tooltip: 'Cleared the embedding screen, awaiting the local screen.',
      };
    case EPipelineStatus.LocalQueued:
      return {
        color: 'indigo',
        icon: <IconCpu size={12} stroke={1.6} />,
        label: 'Local screen',
        motionClass: 'njs-pipeline-pulse',
        tooltip: 'Awaiting the local LLM screen running in your browser.',
        ariaLabel: 'Job is queued for local screen',
      };
    case EPipelineStatus.LocalDone:
      return {
        color: 'teal',
        icon: <IconCircleCheck size={12} stroke={1.6} />,
        label: 'Ready to score',
        tooltip: 'Passed both screens. Will score when you scroll to it.',
      };
    case EPipelineStatus.ClaudeQueued:
      return {
        color: 'blue',
        icon: <IconCloud size={12} stroke={1.6} />,
        label: 'Scoring',
        motionClass: 'njs-pipeline-shimmer',
        tooltip: 'Sent to Claude for scoring.',
      };
    case EPipelineStatus.Scored:
      // Scored jobs are represented by FitScoreRing; this badge is
      // intentionally null so the row stays uncluttered.
      return null;
    case EPipelineStatus.ScreenedOut: {
      const stage =
        job.screenedOutBy === EScreenStage.Local ? 'local screen' : 'embedding';
      return {
        color: 'gray',
        icon: <IconEyeOff size={12} stroke={1.6} />,
        label: 'Dropped',
        tooltip:
          job.screenReason ?? `Filtered out by the ${stage}. Not a match.`,
      };
    }
    case EPipelineStatus.Expired:
      return {
        color: 'gray',
        icon: <IconCircle size={12} stroke={1.6} />,
        label: 'Expired',
        tooltip: 'The posting was no longer reachable when checked.',
      };
    case EPipelineStatus.Error:
      return {
        color: 'red',
        icon: <IconAlertTriangle size={12} stroke={1.6} />,
        label: 'Error',
        tooltip: job.screenReason ?? 'A cascade stage errored on this job.',
      };
    default:
      return null;
  }
}

export function PipelineStatusBadge({
  job,
  isScoring = false,
  isLocalScreening = false,
}: IPipelineStatusBadgeProps) {
  const config = configFor(job, isScoring, isLocalScreening);
  if (!config) return null;

  const badge = (
    <Badge
      size="xs"
      variant="light"
      color={config.color}
      leftSection={config.icon}
      className={config.motionClass}
      aria-label={config.ariaLabel ?? config.label}
    >
      {config.label}
    </Badge>
  );

  if (config.tooltip) {
    return (
      <Tooltip label={config.tooltip} withArrow position="top" w={260} multiline>
        <span aria-live="polite">{badge}</span>
      </Tooltip>
    );
  }
  return <span aria-live="polite">{badge}</span>;
}
