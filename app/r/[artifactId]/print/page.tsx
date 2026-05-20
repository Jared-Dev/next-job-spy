'use client';

import { use } from 'react';

import { markdownToHtml } from '@/lib/resume/markdownToHtml';
import { getTemplate } from '@/lib/resume/templates';
import { adapter } from '@/lib/storage';
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

  const templateId = (artifact.templateId as ETemplateId) ?? ETemplateId.IcTechnical;
  const template = getTemplate(templateId);
  const html = markdownToHtml(artifact.content);

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
