import { Box } from '@mantine/core';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArtifactResumePreview } from '@/components/resume/ArtifactResumePreview';
import { ResumePreview } from '@/components/resume/ResumePreview';
import { SAMPLE_RESUME } from '@/lib/resume/sampleResume';

export const metadata: Metadata = {
  title: 'Resume',
};

/**
 * Resume view — /resume/[artifactId]. A numeric param loads a generated resume
 * artifact and renders it. The literal `sample` param previews the static
 * sample document, kept for design iteration. Renders chrome-free so the page
 * works equally well as a standalone view and as the body of an intercepting
 * modal route.
 */
export default async function ResumeViewPage({
  params,
}: {
  params: Promise<{ artifactId: string }>;
}) {
  const { artifactId } = await params;

  const numericId = Number(artifactId);
  if (Number.isInteger(numericId) && numericId > 0) {
    return (
      <Box h="100vh">
        <ArtifactResumePreview artifactId={numericId} />
      </Box>
    );
  }

  if (artifactId === 'sample') {
    return (
      <Box h="100vh">
        <ResumePreview data={SAMPLE_RESUME} />
      </Box>
    );
  }

  notFound();
}
