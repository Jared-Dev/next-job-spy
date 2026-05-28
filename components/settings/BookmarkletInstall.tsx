'use client';

import { Anchor, Code, List, Paper, Stack, Text, Title } from '@mantine/core';
import { IconBookmark } from '@tabler/icons-react';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { buildBookmarklet } from '@/lib/jobs/importJob/buildBookmarklet';

const NEVER = () => () => {};

/**
 * Renders a draggable "Import to Next Job Spy" link. Users grab it,
 * drop it onto their bookmarks bar, then click it on any job-posting
 * page to pull the role into the local database. Built on the client
 * so the embedded origin matches the dev/prod URL the user is on.
 *
 * React sanitizes `href="javascript:..."` to a thrown-error string for
 * XSS-prevention, so we have to set the href on the raw DOM node after
 * mount via `setAttribute`. That bypasses React's URL allowlist while
 * still letting the user drag a real bookmarklet to their bookmarks bar.
 */
export function BookmarkletInstall() {
  const origin = useSyncExternalStore(
    NEVER,
    () => window.location.origin,
    () => '',
  );
  const anchorRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (!anchorRef.current || !origin) return;
    anchorRef.current.setAttribute('href', buildBookmarklet(origin));
  }, [origin]);

  return (
    <Paper p="lg" withBorder>
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={4}>One-click job import</Title>
          <Text size="sm" c="dimmed">
            Some sites (LinkedIn, Indeed, Glassdoor) block our server from
            reading their pages. The bookmarklet runs in your logged-in tab,
            grabs what you see, and ships it back here. No copy-paste needed.
          </Text>
        </Stack>

        <Paper withBorder p="md" bg="var(--mantine-color-gray-0)">
          <Stack gap="xs" align="flex-start">
            <Text size="sm" fw={500}>
              Drag this link to your bookmarks bar:
            </Text>
            <a
              ref={anchorRef}
              href="#"
              draggable
              onClick={(e) => e.preventDefault()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--mantine-color-gray-4)',
                background: 'var(--mantine-color-white)',
                color: 'var(--mantine-color-blue-7)',
                textDecoration: 'none',
                fontWeight: 600,
                cursor: 'grab',
              }}
            >
              <IconBookmark size={16} stroke={1.8} />
              Import to Next Job Spy
            </a>
            <Text size="xs" c="dimmed">
              Posts back to <Code>{origin || '…'}</Code>. If your dev
              server moves to a different port, revisit this page and drag a
              fresh copy.
            </Text>
          </Stack>
        </Paper>

        <Stack gap={4}>
          <Text size="sm" fw={500}>
            How to use it
          </Text>
          <List size="sm" spacing={4}>
            <List.Item>
              On any job posting (LinkedIn, Indeed, Glassdoor, a careers page,
              wherever), click the bookmark.
            </List.Item>
            <List.Item>
              A new tab opens with the job already saved and Claude scoring it
              in the background.
            </List.Item>
            <List.Item>
              If the page has nothing recognizable, the import will bounce with
              a hint to fill the form in by hand from the{' '}
              <Anchor href="/jobs">Jobs page</Anchor>.
            </List.Item>
          </List>
        </Stack>
      </Stack>
    </Paper>
  );
}
