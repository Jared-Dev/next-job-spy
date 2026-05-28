'use client';

import { Box, Button, Group } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { PDFViewer, pdf } from '@react-pdf/renderer';
import { useMemo, useState } from 'react';

import { CoverLetterDocument } from '@/components/coverLetter/CoverLetterDocument';
import { sanitizeForSave } from '@/lib/cv/filenameSanitizer';

/**
 * Preview + export surface for a cover-letter artifact. Drops the
 * browser-print path entirely: the PDF the user previews is the same one the
 * Export button writes to disk, so the metadata stream is fully under our
 * control (no Skia/Chromium fingerprint from the browser's "Save as PDF").
 */
export function CoverLetterStage({
  markdown,
  candidateName,
  filename,
}: {
  markdown: string;
  candidateName: string;
  /** Clickbait filename the artifact was saved with (must end in .pdf). */
  filename: string;
}) {
  const [busy, setBusy] = useState(false);

  const safeFilename = useMemo(() => sanitizeForSave(filename), [filename]);
  const documentTitle = useMemo(
    () => safeFilename.replace(/\.pdf$/i, ''),
    [safeFilename],
  );

  const documentElement = useMemo(
    () => (
      <CoverLetterDocument
        markdown={markdown}
        candidateName={candidateName}
        documentTitle={documentTitle}
      />
    ),
    [markdown, candidateName, documentTitle],
  );

  function handleExport() {
    setBusy(true);
    void (async () => {
      try {
        const blob = await pdf(documentElement).toBlob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = safeFilename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } finally {
        setBusy(false);
      }
    })();
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Group
        justify="flex-end"
        px="md"
        py="xs"
        style={{
          flex: '0 0 auto',
          borderBottom: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <Button
          size="xs"
          leftSection={<IconDownload size={15} stroke={1.6} />}
          onClick={handleExport}
          loading={busy}
        >
          Export PDF
        </Button>
      </Group>

      <Box style={{ flex: 1, minHeight: 0 }}>
        <PDFViewer className="njs-pdf-frame" width="100%" height="100%">
          {documentElement}
        </PDFViewer>
      </Box>
    </Box>
  );
}
