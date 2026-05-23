'use client';

import { useState } from 'react';
import { Box, Button, Group, Text } from '@mantine/core';
import { IconDownload, IconExternalLink } from '@tabler/icons-react';
import { PDFViewer, pdf } from '@react-pdf/renderer';

import { GeneralistDocument } from '@/components/resume/pdf/GeneralistDocument';
import { IcTechnicalDocument } from '@/components/resume/pdf/IcTechnicalDocument';
import { LeaderDocument } from '@/components/resume/pdf/LeaderDocument';
import type { IResumeDocument } from '@/lib/resume/types/IResumeDocument';
import { ETemplateId } from '@/lib/storage/types/ETemplateId';

/** Template id maps to the react-pdf document that renders it. */
const RESUME_DOCUMENTS = {
  [ETemplateId.IcTechnical]: IcTechnicalDocument,
  [ETemplateId.Leader]: LeaderDocument,
  [ETemplateId.Generalist]: GeneralistDocument,
};

/**
 * Resume preview surface — a toolbar over an inline PDF viewer. The viewer and
 * the Export button render the *same* template document, so the preview is the
 * exported file. Loaded client-only (react-pdf's viewer touches browser APIs).
 *
 * Export currently downloads the generated PDF. Once artifact storage lands,
 * Export will also persist the blob and View will reopen the stored copy.
 */
export function ResumeStage({
  templateId,
  data,
}: {
  templateId: ETemplateId;
  data: IResumeDocument;
}) {
  const [busy, setBusy] = useState(false);

  const ResumeDoc = RESUME_DOCUMENTS[templateId];

  async function withPdf(consume: (blob: Blob) => void) {
    setBusy(true);
    try {
      const blob = await pdf(<ResumeDoc data={data} />).toBlob();
      consume(blob);
    } finally {
      setBusy(false);
    }
  }

  function handleExport() {
    void withPdf((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${data.name.replace(/\s+/g, '-')}-Resume.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  }

  function handleView() {
    void withPdf((blob) => {
      window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
    });
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Group
        justify="space-between"
        px="md"
        py="xs"
        style={{
          flex: '0 0 auto',
          borderBottom: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <Text fw={600} size="sm">
          Resume preview
        </Text>
        <Group gap="xs">
          <Button
            variant="default"
            size="xs"
            leftSection={<IconExternalLink size={15} stroke={1.6} />}
            onClick={handleView}
            loading={busy}
          >
            View
          </Button>
          <Button
            size="xs"
            leftSection={<IconDownload size={15} stroke={1.6} />}
            onClick={handleExport}
            loading={busy}
          >
            Export PDF
          </Button>
        </Group>
      </Group>

      <Box style={{ flex: 1, minHeight: 0 }}>
        <PDFViewer className="njs-pdf-frame" width="100%" height="100%">
          <ResumeDoc data={data} />
        </PDFViewer>
      </Box>
    </Box>
  );
}
