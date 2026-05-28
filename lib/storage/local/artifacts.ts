'use client';

import { useEffect, useState } from 'react';

import type { IArtifact } from '@/lib/storage/types/IArtifact';

import {
  getArtifactAction,
  listArtifactsAction,
  pinArtifactAction,
  resignCoverLetterArtifactsAction,
  saveArtifactAction,
} from './actions/artifacts';
import { REFRESH_EVENTS, emitRefresh } from './refreshEvents';

export function useArtifacts(jobId?: number): IArtifact[] | undefined {
  const [artifacts, setArtifacts] = useState<IArtifact[] | undefined>();
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      listArtifactsAction(jobId).then((a) => {
        if (!cancelled) setArtifacts(a);
      });
    };
    load();
    if (typeof window !== 'undefined') {
      window.addEventListener(REFRESH_EVENTS.Artifacts, load);
      return () => {
        cancelled = true;
        window.removeEventListener(REFRESH_EVENTS.Artifacts, load);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [jobId]);
  return artifacts;
}

export function useArtifact(id: number): IArtifact | undefined {
  const [artifact, setArtifact] = useState<IArtifact | undefined>();
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getArtifactAction(id).then((a) => {
        if (!cancelled) setArtifact(a ?? undefined);
      });
    };
    load();
    if (typeof window !== 'undefined') {
      window.addEventListener(REFRESH_EVENTS.Artifacts, load);
      return () => {
        cancelled = true;
        window.removeEventListener(REFRESH_EVENTS.Artifacts, load);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [id]);
  return artifact;
}

export async function saveArtifact(artifact: IArtifact): Promise<number> {
  const id = await saveArtifactAction(artifact);
  emitRefresh(REFRESH_EVENTS.Artifacts);
  return id;
}

export async function pinArtifact(id: number, pinned: boolean): Promise<void> {
  await pinArtifactAction(id, pinned);
  emitRefresh(REFRESH_EVENTS.Artifacts);
}

export async function resignCoverLetterArtifacts(
  candidateName: string,
): Promise<{ updated: number; total: number }> {
  const result = await resignCoverLetterArtifactsAction(candidateName);
  if (result.updated > 0) emitRefresh(REFRESH_EVENTS.Artifacts);
  return result;
}
