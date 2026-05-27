'use client';

import { Modal } from '@mantine/core';
import { useRouter } from 'next/navigation';

import { ArtifactResumePreview } from '@/components/resume/ArtifactResumePreview';

/**
 * Modal shell for the intercepting resume route. Stays mounted with
 * `opened={true}` for as long as the parallel slot is active; closing it
 * triggers `router.back()`, which exits the slot and returns to the job page.
 *
 * The modal owns its own height (85vh) so the chain of `height: 100%` inside
 * `ArtifactResumePreview` → `ResumeStage` → the react-pdf `<iframe>` resolves
 * to a real pixel value. Without that, the iframe collapses to its content's
 * native height and the rest of the modal is empty space.
 *
 * Padding is only zeroed on the body so the PDF viewer fills it; the header
 * keeps Mantine's default padding so the "Resume" title and close button
 * aren't flush against the modal edge.
 *
 * The overlay carries an explicit `onMouseDown` close handler in addition to
 * Mantine's default click-to-close. A focused PDF viewer iframe inside the
 * modal can swallow the first `click` event (the one that defocuses the
 * iframe), so click-outside-to-close otherwise needed two clicks. `mousedown`
 * fires earlier and isn't consumed.
 */
export function ResumeArtifactModal({ artifactId }: { artifactId: number }) {
  const router = useRouter();

  return (
    <Modal
      opened
      onClose={() => router.back()}
      withCloseButton
      title="Resume"
      centered
      size="auto"
      styles={{
        content: { width: 'min(1100px, 95vw)' },
        body: { padding: 0, height: '85vh' },
      }}
      overlayProps={{
        onMouseDown: (e) => {
          // Only close on direct hits — clicks bubbled up from inside the
          // dialog (e.g. the iframe) shouldn't dismiss the modal.
          if (e.target === e.currentTarget) {
            router.back();
          }
        },
      }}
    >
      <ArtifactResumePreview artifactId={artifactId} />
    </Modal>
  );
}
