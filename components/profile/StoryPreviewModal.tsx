'use client';

import { Box, Button, Group, Modal } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import { PDFViewer } from '@react-pdf/renderer';
import { useMemo } from 'react';

import { CoverLetterDocument } from '@/components/coverLetter/CoverLetterDocument';
import type { ICvStory } from '@/lib/cv/types/ICvStory';

/**
 * Preview the saved story as the PDF a recruiter would actually see. Uses the
 * same CoverLetterDocument the real export pipeline uses, so the layout here
 * matches the file that ships with a job application. No job context is
 * injected, the candidate is reading the raw story shape, which is what they
 * need in order to spot copy that won't land before they commit to it.
 *
 * Issues / corrections route through the existing edit flow: hitting "Edit
 * story" closes the preview and opens the StoryEditorModal so the candidate
 * can tweak the text. Re-opening the preview shows the new render.
 */
export function StoryPreviewModal({
  opened,
  story,
  candidateName,
  onClose,
  onEdit,
}: {
  opened: boolean;
  story: ICvStory | null;
  candidateName: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  // The PDFViewer iframe re-mounts on every child reference change, so the
  // document JSX has to be a stable reference across renders of this modal.
  // Keys are intentionally primitive (id/content/title), not `story` itself,
  // so the memo stays stable across renders where the parent re-derives the
  // same story object reference.
  const storyId = story?.id;
  const storyContent = story?.content;
  const storyTitle = story?.title;
  const documentElement = useMemo(() => {
    if (!storyId || storyContent === undefined || storyTitle === undefined) return null;
    return (
      <CoverLetterDocument
        markdown={storyContent}
        candidateName={candidateName}
        documentTitle={storyTitle}
      />
    );
  }, [storyId, storyContent, storyTitle, candidateName]);

  return (
    <Modal
      opened={opened && story !== null}
      onClose={onClose}
      title={story?.title ?? 'Story preview'}
      size="auto"
      centered
      styles={{
        content: { width: 'min(900px, 95vw)' },
        body: { padding: 0, height: '80vh', display: 'flex', flexDirection: 'column' },
      }}
    >
      <Box style={{ flex: 1, minHeight: 0 }}>
        {documentElement ? (
          <PDFViewer className="njs-pdf-frame" width="100%" height="100%">
            {documentElement}
          </PDFViewer>
        ) : null}
      </Box>
      <Group
        justify="flex-end"
        gap="sm"
        px="md"
        py="xs"
        style={{
          flex: '0 0 auto',
          borderTop: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <Button variant="default" onClick={onClose}>
          Close
        </Button>
        <Button
          leftSection={<IconPencil size={14} stroke={1.6} />}
          onClick={onEdit}
        >
          Edit story
        </Button>
      </Group>
    </Modal>
  );
}
