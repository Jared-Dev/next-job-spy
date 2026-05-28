'use client';

import { Center, Loader, Text } from '@mantine/core';
import { useMemo } from 'react';

import { ResumePreview } from '@/components/resume/ResumePreview';
import {
  type IResumeDocument,
  ResumeDocumentSchema,
} from '@/lib/resume/types/IResumeDocument';
import { adapter } from '@/lib/storage';

/**
 * Loads a generated resume artifact by id and renders it. The artifact's
 * `content` is the IResumeDocument JSON produced by resume generation. The
 * artifact's `jobId` is used to look up the job so the exported PDF's
 * filename can include the company + role.
 *
 * Parse + job context are memoised so the downstream PDFViewer iframe sees
 * stable props across renders; without that the iframe can churn and stick
 * on an empty / broken state when a parent (modal animation, useArtifact
 * tick) re-renders.
 */
export function ArtifactResumePreview({ artifactId }: { artifactId: number }) {
  const artifact = adapter.useArtifact(artifactId);
  // Hooks must run unconditionally, pass 0 when there's no job to look up.
  // useJob returns undefined for an unknown id, which we handle below.
  const job = adapter.useJob(artifact?.jobId ?? 0);

  // Memo against the primitive content string so a useArtifact re-tick (same
  // content, new artifact object reference) doesn't bust the cached parse and
  // re-render the downstream PDFViewer.
  const content = artifact?.content;
  const parsed = useMemo<
    { ok: true; data: IResumeDocument } | { ok: false } | null
  >(() => {
    if (content === undefined) return null;
    try {
      const data = ResumeDocumentSchema.parse(JSON.parse(content));
      return { ok: true, data };
    } catch {
      return { ok: false };
    }
  }, [content]);

  // Pull the two scalars out so the memo dep list is primitive and a job
  // identity tick (same title + company, new object reference) does not
  // invalidate the downstream PDFViewer's stable document JSX.
  const jobTitle = job?.title;
  const jobCompany = job?.company;
  // Deps are the primitive scalars on purpose: a re-tick of useJob can return
  // the same { title, company } with a fresh object reference, and we don't
  // want that to invalidate the memo (the downstream PDFViewer treats a new
  // reference as "regenerate the PDF").
  const jobContext = useMemo(
    () =>
      jobTitle || jobCompany
        ? { title: jobTitle, company: jobCompany }
        : undefined,
    [jobTitle, jobCompany],
  );

  if (artifact === undefined || parsed === null) {
    return (
      <Center h="100%">
        <Loader size="sm" />
      </Center>
    );
  }

  if (!parsed.ok) {
    return (
      <Center h="100%">
        <Text size="sm" c="dimmed">
          This resume could not be loaded.
        </Text>
      </Center>
    );
  }

  return <ResumePreview data={parsed.data} job={jobContext} />;
}
