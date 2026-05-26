'use client';

import { Alert, Badge, Group, Paper, Text } from '@mantine/core';
import { IconBrain, IconSparkles } from '@tabler/icons-react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAutoTuneGate } from '@/lib/screening/scoring/useAutoTuneGate';
import { useScreeningStatus } from '@/lib/screening/scoring/ScreeningStatusContext';
import { useViewDrivenScoring } from '@/lib/screening/scoring/useViewDrivenScoring';
import type { IJob } from '@/lib/storage/types/IJob';

import { JobRow } from './JobRow';

interface IJobsVirtualListProps {
  jobs: IJob[];
}

const ROW_ESTIMATE = 110;
const ROW_GAP = 12;

export function JobsVirtualList({ jobs }: IJobsVirtualListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [inFlightIds, setInFlightIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!parentRef.current) return;
    const measure = () => {
      if (parentRef.current) {
        const rect = parentRef.current.getBoundingClientRect();
        setScrollMargin(rect.top + window.scrollY);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const { currentLocalJobIds, recentlyDroppedIds } = useScreeningStatus();

  // Position-preserving merge for the exit animation: keep just-
  // dropped rows mounted at their original position so the row-exit
  // class plays in place rather than the row jumping or vanishing
  // when the cascade refetch lands.
  //
  // `outgoing` is state (not a ref) so the merge can read it during
  // render without violating react-hooks/refs. The effect below
  // snapshots a row into `outgoing` the first render after it's
  // marked dropped, then drops the entry when the timer in
  // ScreeningStatusContext removes the id.
  const [outgoing, setOutgoing] = useState<
    ReadonlyMap<number, { job: IJob; originalIndex: number }>
  >(() => new Map());

  // Snapshot rows that just got marked dropped so they survive the
  // refetch that's about to remove them. This is the canonical
  // "derive-state-from-props-but-remember-across-a-prop-change" case;
  // the only alternative would be reading a ref during render, which
  // the React 19 lint rules also forbid.
  useEffect(() => {
    const currentIds = new Set<number>();
    for (const j of jobs) {
      if (typeof j.id === 'number') currentIds.add(j.id);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOutgoing((prev) => {
      const next = new Map<number, { job: IJob; originalIndex: number }>();
      for (const [id, entry] of prev) {
        if (recentlyDroppedIds.has(id) && !currentIds.has(id)) next.set(id, entry);
      }
      for (let i = 0; i < jobs.length; i += 1) {
        const j = jobs[i];
        if (typeof j.id !== 'number') continue;
        if (recentlyDroppedIds.has(j.id) && !next.has(j.id)) {
          next.set(j.id, { job: j, originalIndex: i });
        }
      }
      if (next.size === prev.size) {
        let same = true;
        for (const [k, v] of next) {
          if (prev.get(k) !== v) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return next;
    });
  }, [jobs, recentlyDroppedIds]);

  const renderJobs = useMemo<IJob[]>(() => {
    if (outgoing.size === 0) return jobs;
    const currentIds = new Set<number>();
    for (const j of jobs) {
      if (typeof j.id === 'number') currentIds.add(j.id);
    }
    const inserts = [...outgoing.entries()]
      .filter(([id]) => !currentIds.has(id))
      .sort((a, b) => a[1].originalIndex - b[1].originalIndex);
    if (inserts.length === 0) return jobs;
    const out: IJob[] = [...jobs];
    for (const [, entry] of inserts) {
      const pos = Math.min(entry.originalIndex, out.length);
      out.splice(pos, 0, entry.job);
    }
    return out;
  }, [jobs, outgoing]);

  const virtualizer = useWindowVirtualizer({
    count: renderJobs.length,
    estimateSize: () => ROW_ESTIMATE + ROW_GAP,
    overscan: 6,
    scrollMargin,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Stable callback the hook can poll each tick. We mirror virtualItems
  // into a ref via a post-commit effect so this function identity is
  // stable (the pump would re-arm if it changed every render).
  const visibleItemsRef = useRef<typeof virtualItems>([]);
  useEffect(() => {
    visibleItemsRef.current = virtualItems;
  });
  const getVisibleIndices = useCallback(
    () => visibleItemsRef.current.map((v) => v.index),
    [],
  );

  const onInFlightChange = useCallback((set: ReadonlySet<number>) => {
    // Copy into a fresh Set so React detects the change; the hook
    // mutates the same Set reference for in-flight tracking.
    setInFlightIds(new Set(set));
  }, []);

  useViewDrivenScoring({
    jobs,
    getVisibleIndices,
    onInFlightChange,
  });

  const gate = useAutoTuneGate();
  const scoringPaused = gate !== null && !gate.isSettled;

  return (
    <>
      {scoringPaused ? (
        <Alert
          icon={<IconBrain size={18} />}
          color="indigo"
          variant="light"
          title="Claude scoring paused while auto-tune learns"
        >
          The embedding threshold isn&apos;t settled yet
          {gate
            ? ` (${Math.round(gate.confidence * 100)}% confident)`
            : ''}
          , so Claude isn&apos;t being asked to rank jobs that pass the
          cascade. Scoring resumes automatically once auto-tune declares
          the threshold stable. Turn off auto-tune in Settings to score
          manually.
        </Alert>
      ) : null}

      {inFlightIds.size > 0 ? (
        <Paper p="xs" withBorder>
          <Group gap="xs" justify="space-between">
            <Group gap="xs">
              <IconSparkles size={14} stroke={1.6} />
              <Text size="sm">
                Scoring {inFlightIds.size} job
                {inFlightIds.size === 1 ? '' : 's'} you are looking at...
              </Text>
            </Group>
            <Badge variant="light" size="sm">
              in flight
            </Badge>
          </Group>
        </Paper>
      ) : null}

      <div ref={parentRef} style={{ position: 'relative' }}>
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: 'relative',
            width: '100%',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const job = renderJobs[virtualRow.index];
            if (!job) return null;
            const droppedStage =
              typeof job.id === 'number'
                ? recentlyDroppedIds.get(job.id)
                : undefined;
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                  paddingBottom: ROW_GAP,
                }}
              >
                <JobRow
                  job={job}
                  isScoring={
                    typeof job.id === 'number' && inFlightIds.has(job.id)
                  }
                  isLocalScreening={
                    typeof job.id === 'number' &&
                    currentLocalJobIds.has(job.id)
                  }
                  droppedAtStage={droppedStage}
                />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
