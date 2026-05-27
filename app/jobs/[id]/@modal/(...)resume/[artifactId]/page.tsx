import { notFound } from 'next/navigation';

import { ResumeArtifactModal } from '@/components/resume/ResumeArtifactModal';

/**
 * Intercepting route — when the user is on /jobs/[id] and clicks a soft link
 * to /resume/[artifactId], this route fires inside the @modal parallel slot
 * and renders the resume as a modal overlay over the job page. A hard nav
 * (direct URL, refresh, new tab) falls through to /resume/[artifactId]/page.tsx
 * and renders the standalone view.
 *
 * (...) means "intercept from the app root" — since @modal is a slot rather
 * than a segment, /resume/[id] is reachable from the app root and we need to
 * traverse there to hook it.
 */
export default async function InterceptedResumePage({
  params,
}: {
  params: Promise<{ artifactId: string }>;
}) {
  const { artifactId } = await params;
  const numericId = Number(artifactId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    notFound();
  }
  return <ResumeArtifactModal artifactId={numericId} />;
}
