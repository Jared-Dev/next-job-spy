'use client';

import { Box, Center, Loader, Text } from '@mantine/core';
import { redirect } from 'next/navigation';
import { use, useEffect } from 'react';

import { CoverLetterStage } from '@/components/coverLetter/CoverLetterStage';
import { adapter } from '@/lib/storage';
import { EArtifactKind } from '@/lib/storage/types/EArtifactKind';

/**
 * Cover-letter view at /resume/[artifactId]/print. Despite the route name, the
 * browser's "Save as PDF" path is no longer used: the page renders the letter
 * through @react-pdf so the exported file's metadata stream (Producer,
 * Creator, Subject, Keywords) is fully under our control and free of any
 * library or browser fingerprint.
 *
 * Resume artifacts redirect to /resume/[id], which has its own react-pdf
 * stage; this page is cover-letter-only.
 */
export default function PrintArtifactPage({
  params,
}: {
  params: Promise<{ artifactId: string }>;
}) {
  const { artifactId } = use(params);
  const id = Number(artifactId);
  const artifact = adapter.useArtifact(id);
  const profile = adapter.useProfile();

  useEffect(() => {
    if (artifact?.filename) {
      const title = artifact.filename.replace(/\.pdf$/i, '');
      const previous = document.title;
      document.title = title;
      return () => {
        document.title = previous;
      };
    }
    return undefined;
  }, [artifact?.filename]);

  if (artifact === undefined || profile === undefined) {
    return (
      <Center h="100vh">
        <Loader size="sm" />
      </Center>
    );
  }

  if (!artifact) {
    return (
      <Center h="100vh">
        <Text size="sm" c="dimmed">Cover letter not found.</Text>
      </Center>
    );
  }

  if (artifact.kind !== EArtifactKind.CoverLetter) {
    redirect(`/resume/${id}`);
  }

  const candidateName = profile?.fullName?.trim() || 'Candidate';
  const filename = artifact.filename ?? 'Cover Letter.pdf';

  return (
    <Box style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <CoverLetterStage
        markdown={artifact.content}
        candidateName={candidateName}
        filename={filename}
      />
    </Box>
  );
}
