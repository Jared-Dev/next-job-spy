'use client';

import {
  Anchor,
  Box,
  Center,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconArrowLeft, IconSparkles } from '@tabler/icons-react';
import Link from 'next/link';

import { CvInterviewWorkspace } from '@/components/profile/CvInterviewWorkspace';
import { adapter } from '@/lib/storage';

/**
 * Standalone full-page workspace for the CV interview at /profile/story.
 * Reached by direct nav, refresh, deep link, or the "Open in full view"
 * anchor inside the intercepting modal. Soft navigations from /profile are
 * caught by the intercepting modal at app/profile/@modal/(.)story/page.tsx
 * instead.
 *
 * Layout uses the full viewport (100vh) with a thin header strip and the
 * workspace claiming everything below. No app chrome competes for vertical
 * space; the chat scrolls inside its own container so the page itself
 * doesn't scroll.
 */
export default function StoryWorkspacePage() {
  const profile = adapter.useProfile();

  return (
    <Box
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Group
        justify="space-between"
        px="md"
        py="xs"
        style={{
          flex: '0 0 auto',
          borderBottom: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <Group gap="xs">
          <IconSparkles size={18} stroke={1.6} color="var(--mantine-color-indigo-5)" />
          <Title order={5} fw={600}>
            Your story
          </Title>
        </Group>
        <Anchor
          component={Link}
          href="/profile"
          size="sm"
          underline="hover"
        >
          <Group gap={4} wrap="nowrap">
            <IconArrowLeft size={14} stroke={1.6} />
            <span>Back to profile</span>
          </Group>
        </Anchor>
      </Group>

      <Box style={{ flex: 1, minHeight: 0 }}>
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
              <Anchor component={Link} href="/profile" size="sm">
                Back to profile →
              </Anchor>
            </Stack>
          </Center>
        ) : (
          <CvInterviewWorkspace profile={profile} />
        )}
      </Box>
    </Box>
  );
}
