'use client';

import { Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconExclamationCircle,
  IconSignature,
} from '@tabler/icons-react';
import { useState } from 'react';

import { adapter } from '@/lib/storage';

/**
 * One-shot data fix for cover-letter artifacts that pre-date the auto-sign
 * pass. Walks every saved cover letter, appends the candidate's name as a
 * closing line if it isn't already signed, and writes the patched content
 * back. Safe to run repeatedly: already-signed letters are skipped.
 *
 * Lives in /settings because it's a one-time maintenance action; once the
 * existing artifacts are signed, new ones generate signed automatically and
 * this tile becomes a no-op the user shouldn't need to revisit.
 */
export function CoverLetterMaintenance() {
  const profile = adapter.useProfile();
  const [busy, setBusy] = useState(false);

  const candidateName = profile?.fullName?.trim() ?? '';
  const disabled = busy || candidateName.length === 0;

  async function handleResign() {
    if (disabled) return;
    setBusy(true);
    try {
      const { updated, total } = await adapter.resignCoverLetterArtifacts(
        candidateName,
      );
      if (updated === 0) {
        notifications.show({
          color: 'gray',
          icon: <IconCheck size={18} />,
          title: 'Nothing to do',
          message:
            total === 0
              ? 'No cover letters saved yet.'
              : `All ${total} cover letters are already signed.`,
        });
      } else {
        notifications.show({
          color: 'teal',
          icon: <IconCheck size={18} />,
          title: 'Cover letters signed',
          message: `Re-signed ${updated} of ${total} cover letters with "${candidateName}".`,
        });
      }
    } catch (err) {
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Could not re-sign cover letters',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Paper p="lg" withBorder>
      <Stack gap="sm">
        <Group gap="xs">
          <IconSignature size={20} stroke={1.6} color="var(--mantine-color-indigo-5)" />
          <Title order={4} fw={600}>
            Cover letter signatures
          </Title>
        </Group>
        <Text size="sm" c="dimmed">
          Older cover letters in your library may have shipped without a closing
          signature. New ones now sign automatically. Run this to patch any
          existing letter that ends without your name. Safe to run more than
          once.
        </Text>
        {candidateName.length === 0 ? (
          <Text size="xs" c="orange.7">
            Set your full name on the Profile page first; the signature uses it.
          </Text>
        ) : null}
        <Group>
          <Button
            leftSection={<IconSignature size={16} stroke={1.6} />}
            onClick={handleResign}
            loading={busy}
            disabled={disabled}
          >
            Re-sign existing cover letters
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
