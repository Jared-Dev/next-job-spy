'use client';

import { Anchor, Center, Loader, Modal, Stack, Text } from '@mantine/core';
import { useRouter } from 'next/navigation';

import { CvInterviewWorkspace } from '@/components/profile/CvInterviewWorkspace';
import { adapter } from '@/lib/storage';

/**
 * Modal shell for the intercepting /profile/story route. Stays mounted with
 * `opened={true}` for as long as the parallel slot is active; closing it
 * triggers `router.back()`, which exits the slot and returns to /profile.
 *
 * Focus trap is intentional here, this is a "pull the story out of you"
 * workspace and the seal-off is the point. Esc, the close X, and clicking
 * the dimmed overlay all dismiss; there's also an explicit "Open in full
 * view" anchor on the header that does a hard nav to the standalone page
 * (which renders chrome-free) for users who want the immersion turned up
 * even further.
 */
export function CvStoryInterviewModal() {
  const router = useRouter();
  const profile = adapter.useProfile();

  return (
    <Modal
      opened
      onClose={() => router.back()}
      withCloseButton
      title={
        <Anchor
          href="/profile/story"
          // Plain <a>-style nav so the URL re-loads outside the intercept
          // and lands on the standalone full-page workspace.
          underline="hover"
          size="sm"
          fw={500}
        >
          Your story · Open in full view →
        </Anchor>
      }
      centered
      size="auto"
      styles={{
        content: { width: 'min(1100px, 95vw)' },
        body: { padding: 0, height: '85vh' },
      }}
      overlayProps={{
        onMouseDown: (e) => {
          if (e.target === e.currentTarget) router.back();
        },
      }}
    >
      {profile === undefined ? (
        <Center h="100%">
          <Loader size="sm" />
        </Center>
      ) : !profile ? (
        <Center h="100%">
          <Stack align="center" gap="xs">
            <Text size="sm" c="dimmed">
              Fill in your profile first so the interviewer has context.
            </Text>
            <Anchor href="/profile" size="sm">
              Back to profile →
            </Anchor>
          </Stack>
        </Center>
      ) : (
        <CvInterviewWorkspace profile={profile} />
      )}
    </Modal>
  );
}
