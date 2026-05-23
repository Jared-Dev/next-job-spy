import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArtifactResumePreview } from '@/components/resume/ArtifactResumePreview';
import { ResumePreview } from '@/components/resume/ResumePreview';
import { SAMPLE_GENERALIST_RESUME } from '@/lib/resume/sampleGeneralistResume';
import { SAMPLE_LEADER_RESUME } from '@/lib/resume/sampleLeaderResume';
import { SAMPLE_RESUME } from '@/lib/resume/sampleResume';
import { ETemplateId } from '@/lib/storage/types/ETemplateId';

export const metadata: Metadata = {
  title: 'Resume',
};

/**
 * Resume view — /resume/[artifactId]. A numeric param loads a generated resume
 * artifact and renders it. A template-id param (e.g. `ic-technical`) previews
 * that template's static sample, kept for design iteration. Renders
 * chrome-free.
 */
export default async function ResumeViewPage({
  params,
}: {
  params: Promise<{ artifactId: string }>;
}) {
  const { artifactId } = await params;

  const numericId = Number(artifactId);
  if (Number.isInteger(numericId) && numericId > 0) {
    return <ArtifactResumePreview artifactId={numericId} />;
  }

  switch (artifactId) {
    case ETemplateId.IcTechnical:
      return (
        <ResumePreview
          templateId={ETemplateId.IcTechnical}
          data={SAMPLE_RESUME}
        />
      );
    case ETemplateId.Leader:
      return (
        <ResumePreview
          templateId={ETemplateId.Leader}
          data={SAMPLE_LEADER_RESUME}
        />
      );
    case ETemplateId.Generalist:
      return (
        <ResumePreview
          templateId={ETemplateId.Generalist}
          data={SAMPLE_GENERALIST_RESUME}
        />
      );
    default:
      // Not a known template id.
      notFound();
  }
}
