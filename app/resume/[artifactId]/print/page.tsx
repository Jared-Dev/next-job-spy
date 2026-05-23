'use client';

import { redirect } from 'next/navigation';
import { use } from 'react';

import { COVER_LETTER_PRINT_CSS } from '@/lib/coverLetter/coverLetterPrintCss';
import { markdownToHtml } from '@/lib/resume/markdownToHtml';
import { adapter } from '@/lib/storage';
import { EArtifactKind } from '@/lib/storage/types/EArtifactKind';

/**
 * Print view for cover-letter artifacts, which are Markdown. Resume artifacts
 * are structured documents now, so they redirect to /resume/[id] — the
 * react-pdf preview with its own export.
 */
export default function PrintArtifactPage({
  params,
}: {
  params: Promise<{ artifactId: string }>;
}) {
  const { artifactId } = use(params);
  const id = Number(artifactId);
  const artifact = adapter.useArtifact(id);

  if (artifact === undefined) {
    return null;
  }

  if (artifact.kind !== EArtifactKind.CoverLetter) {
    redirect(`/resume/${id}`);
  }

  const html = markdownToHtml(artifact.content);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: COVER_LETTER_PRINT_CSS }} />
      <div className="cover-letter" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
