'use client';

import { Center, Loader, Text } from '@mantine/core';

import { ResumePreview } from '@/components/resume/ResumePreview';
import {
  type IResumeDocument,
  ResumeDocumentSchema,
} from '@/lib/resume/types/IResumeDocument';
import { adapter } from '@/lib/storage';
import { ETemplateId } from '@/lib/storage/types/ETemplateId';

/**
 * Loads a generated resume artifact by id and renders it. The artifact's
 * `content` is the IResumeDocument JSON produced by resume generation.
 */
export function ArtifactResumePreview({ artifactId }: { artifactId: number }) {
  const artifact = adapter.useArtifact(artifactId);

  if (artifact === undefined) {
    return (
      <Center h="100vh">
        <Loader size="sm" />
      </Center>
    );
  }

  let data: IResumeDocument;
  try {
    data = ResumeDocumentSchema.parse(JSON.parse(artifact.content));
  } catch {
    return (
      <Center h="100vh">
        <Text size="sm" c="dimmed">
          This resume could not be loaded.
        </Text>
      </Center>
    );
  }

  const templateId =
    (artifact.templateId as ETemplateId | undefined) ?? ETemplateId.IcTechnical;

  return <ResumePreview templateId={templateId} data={data} />;
}
