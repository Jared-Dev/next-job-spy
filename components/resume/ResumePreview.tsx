'use client';

import { Center, Loader } from '@mantine/core';
import dynamic from 'next/dynamic';

import type { IResumeDocument } from '@/lib/resume/types/IResumeDocument';
import type { ETemplateId } from '@/lib/storage/types/ETemplateId';

/**
 * Client-only entry point for the resume preview. `@react-pdf/renderer`'s
 * viewer touches browser APIs, so the whole stage is loaded with `ssr: false`
 * and never evaluated on the server.
 */
const ResumeStage = dynamic(
  () => import('@/components/resume/ResumeStage').then((m) => m.ResumeStage),
  {
    ssr: false,
    loading: () => (
      <Center h="100vh">
        <Loader size="sm" />
      </Center>
    ),
  },
);

export function ResumePreview({
  templateId,
  data,
}: {
  templateId: ETemplateId;
  data: IResumeDocument;
}) {
  return <ResumeStage templateId={templateId} data={data} />;
}
