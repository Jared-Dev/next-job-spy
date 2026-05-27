'use client';

import { useMemo, useState } from 'react';
import { Box, Button, Group } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { PDFViewer, pdf } from '@react-pdf/renderer';

import { ResumeDocument } from '@/components/resume/pdf/ResumeDocument';
import type { IResumeDocument } from '@/lib/resume/types/IResumeDocument';

export interface IResumeJobContext {
  title?: string;
  company?: string;
}

/**
 * Resume preview surface — a thin toolbar over an inline PDF viewer. The
 * viewer and the Export button render the *same* document, so the preview is
 * the exported file. Loaded client-only (react-pdf's viewer touches browser
 * APIs).
 *
 * The document JSX is memoised so the embedded `<PDFViewer>` iframe sees a
 * stable child reference across renders. Without that, every parent re-render
 * (job prop updates, useJob ticks, modal animation frames) re-generated the
 * blob and could leave the iframe stuck on an empty / broken state.
 *
 * Only Export PDF is offered (no "Open in new tab"): a blob URL opened that
 * way ends up with a UUID filename in the address bar, which is what the
 * browser uses if the user then hits Save. Export uses the `download`
 * attribute so the saved file picks up a human-readable name.
 */
export function ResumeStage({
  data,
  job,
}: {
  data: IResumeDocument;
  job?: IResumeJobContext;
}) {
  const [busy, setBusy] = useState(false);

  // Pull scalars out so the memo deps stay primitive — a fresh `job` object
  // reference with identical title + company should not bust the PDFViewer's
  // stable document JSX.
  const jobTitle = job?.title;
  const jobCompany = job?.company;
  const filename = useMemo(
    () => buildResumeFilename(data.name, jobTitle, jobCompany),
    [data.name, jobTitle, jobCompany],
  );
  const documentTitle = useMemo(() => filename.replace(/\.pdf$/i, ''), [filename]);

  const documentElement = useMemo(
    () => <ResumeDocument data={data} documentTitle={documentTitle} />,
    [data, documentTitle],
  );

  function handleExport() {
    setBusy(true);
    void (async () => {
      try {
        const blob = await pdf(documentElement).toBlob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
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

/**
 * Save-as filename built from candidate + job context. Format:
 *   "Name - Company - Role.pdf" when both are known.
 *   "Name - Company.pdf" / "Name - Role.pdf" when only one is.
 *   "Name Resume.pdf" when neither is.
 */
function buildResumeFilename(
  name: string,
  jobTitle: string | undefined,
  jobCompany: string | undefined,
): string {
  const safe = (s: string) =>
    s.replace(/\s+/g, ' ').replace(/[\\/:*?"<>|]/g, '').trim();
  const cleanName = safe(name) || 'Resume';
  const cleanCompany = jobCompany ? safe(jobCompany) : '';
  const cleanTitle = jobTitle ? safe(jobTitle) : '';
  const parts = [cleanName, cleanCompany, cleanTitle].filter(Boolean);
  if (parts.length === 1) return `${parts[0]} Resume.pdf`;
  return `${parts.join(' - ')}.pdf`;
}
