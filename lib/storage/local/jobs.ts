'use client';

import { useEffect, useState } from 'react';

import type { IJob } from '@/lib/storage/types/IJob';
import type { IJobFilters } from '@/lib/storage/types/IJobFilters';

import {
  getJobAction,
  listJobsAction,
  updateJobFitAction,
  updateJobStatusAction,
  upsertJobsAction,
} from './actions/jobs';
import { REFRESH_EVENTS, emitRefresh } from './refreshEvents';

export function useJobs(filters?: IJobFilters): IJob[] | undefined {
  const [jobs, setJobs] = useState<IJob[] | undefined>();
  const key = JSON.stringify(filters ?? null);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      listJobsAction(filters).then((j) => {
        if (!cancelled) setJobs(j);
      });
    };
    load();
    if (typeof window !== 'undefined') {
      window.addEventListener(REFRESH_EVENTS.Jobs, load);
      return () => {
        cancelled = true;
        window.removeEventListener(REFRESH_EVENTS.Jobs, load);
      };
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return jobs;
}

export function useJob(id: number): IJob | undefined {
  const [job, setJob] = useState<IJob | undefined>();
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getJobAction(id).then((j) => {
        if (!cancelled) setJob(j ?? undefined);
      });
    };
    load();
    if (typeof window !== 'undefined') {
      window.addEventListener(REFRESH_EVENTS.Jobs, load);
      return () => {
        cancelled = true;
        window.removeEventListener(REFRESH_EVENTS.Jobs, load);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [id]);
  return job;
}

export async function upsertJobs(
  jobs: IJob[],
): Promise<{ inserted: number; updated: number }> {
  const result = await upsertJobsAction(jobs);
  emitRefresh(REFRESH_EVENTS.Jobs);
  return result;
}

export async function updateJobStatus(
  id: number,
  status: IJob['status'],
): Promise<void> {
  await updateJobStatusAction(id, status);
  emitRefresh(REFRESH_EVENTS.Jobs);
}

export async function updateJobFit(
  id: number,
  fitScore: number,
  fitNotes: string,
): Promise<void> {
  await updateJobFitAction(id, fitScore, fitNotes);
  emitRefresh(REFRESH_EVENTS.Jobs);
}
