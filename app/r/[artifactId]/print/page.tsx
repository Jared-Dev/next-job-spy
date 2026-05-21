'use client';

import { use } from 'react';

import { COVER_LETTER_PRINT_CSS } from '@/lib/coverLetter/coverLetterPrintCss';
import { markdownToHtml } from '@/lib/resume/markdownToHtml';
import { getTemplate } from '@/lib/resume/templates';
import { adapter } from '@/lib/storage';
import { EArtifactKind } from '@/lib/storage/types/EArtifactKind';
import { ETemplateId } from '@/lib/storage/types/ETemplateId';

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

  const html = markdownToHtml(artifact.content);

  if (artifact.kind === EArtifactKind.CoverLetter) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: COVER_LETTER_PRINT_CSS }} />
        <div className="cover-letter" dangerouslySetInnerHTML={{ __html: html }} />
      </>
    );
  }

  const templateId = (artifact.templateId as ETemplateId) ?? ETemplateId.IcTechnical;
  const template = getTemplate(templateId);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: template.printCss }} />
      <div className="resume" dangerouslySetInnerHTML={{ __html: html }} />
      <noscript>
        <style>{`@media print { html, body { background: white; } }`}</style>
      </noscript>
    </>
  );
}
