'use client';

import { Alert, Anchor, Group, List, Loader, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconShieldCheck } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { postJson } from '@/lib/ai/postJson';
import type { IVerifyResult } from '@/lib/ai/types/IVerifyResult';
import { adapter } from '@/lib/storage';
import { EVerificationMode } from '@/lib/storage/types/EVerificationMode';

import type { IVerificationNoticeProps } from './types/IVerificationNoticeProps';

/** Artifacts created within this window are auto-checked; older ones wait for a click. */
const FRESH_WINDOW_SECONDS = 150;

function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

function modelLabel(modelId: string): string {
  if (modelId.includes('haiku')) return 'Haiku';
  if (modelId.includes('sonnet')) return 'Sonnet';
  if (modelId.includes('opus')) return 'Opus';
  return modelId;
}

export function VerificationNotice({ artifact }: IVerificationNoticeProps) {
  const profile = adapter.useProfile();
  const settings = adapter.useSettings();
  const [results, setResults] = useState<Record<number, IVerifyResult>>({});
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const artifactId = typeof artifact.id === 'number' ? artifact.id : null;
  const result = artifactId !== null ? results[artifactId] : undefined;
  const checking = artifactId !== null && checkingId === artifactId;

  async function runCheck() {
    if (artifactId === null || !profile) return;
    setError(null);
    setCheckingId(artifactId);
    try {
      const data = await postJson<IVerifyResult>('/api/ai/verify-resume', {
        content: artifact.content,
        profile,
        mode: settings?.verificationMode ?? EVerificationMode.Thorough,
        crossCheckNumbers: settings?.crossCheckNumbers !== false,
      });
      setResults((cur) => ({ ...cur, [artifactId]: data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setCheckingId(null);
    }
  }

  // Auto-check freshly generated artifacts; older ones wait for an explicit click.
  useEffect(() => {
    if (artifactId === null || !profile) return;
    if (results[artifactId] || checkingId === artifactId) return;
    if (unixNow() - artifact.createdAt <= FRESH_WINDOW_SECONDS) {
      // Defer so the check's state updates land after the effect commits.
      queueMicrotask(() => {
        void runCheck();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactId, profile]);

  if (artifactId === null) return null;

  if (checking) {
    return (
      <Group gap="xs" c="dimmed">
        <Loader size="xs" />
        <Text size="sm">Checking every claim against your profile…</Text>
      </Group>
    );
  }

  if (error) {
    return (
      <Alert color="gray" variant="light" title="Couldn't verify">
        <Stack gap="xs">
          <Text size="sm">{error}</Text>
          <Anchor component="button" type="button" size="sm" onClick={() => void runCheck()}>
            Try again
          </Anchor>
        </Stack>
      </Alert>
    );
  }

  if (!result) {
    return (
      <Group gap="xs">
        <Text size="sm" c="dimmed">
          Not yet checked against your profile.
        </Text>
        <Anchor component="button" type="button" size="sm" onClick={() => void runCheck()}>
          Verify now
        </Anchor>
      </Group>
    );
  }

  const recheck = (
    <Anchor component="button" type="button" size="xs" onClick={() => void runCheck()}>
      Re-check
    </Anchor>
  );

  if (result.findings.length === 0) {
    return (
      <Alert
        color="teal"
        variant="light"
        icon={<IconShieldCheck size={18} />}
        title="Verified — every claim traces to your profile"
      >
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Checked with {modelLabel(result.modelUsed)}.
          </Text>
          {recheck}
        </Group>
      </Alert>
    );
  }

  return (
    <Alert
      color="orange"
      variant="light"
      icon={<IconAlertTriangle size={18} />}
      title={`${result.findings.length} claim${
        result.findings.length === 1 ? '' : 's'
      } to review`}
    >
      <Stack gap="xs">
        <Text size="sm">
          These claims in the generated document may not be backed by your
          profile. Review each one before sending it to an employer.
        </Text>
        <List size="sm" spacing={6}>
          {result.findings.map((finding, index) => (
            <List.Item key={`${finding.claim}-${index}`}>
              <Text size="sm" fw={500} component="span">
                “{finding.claim}”
              </Text>
              {' — '}
              <Text size="sm" c="dimmed" component="span">
                {finding.issue}
              </Text>
            </List.Item>
          ))}
        </List>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Checked with {modelLabel(result.modelUsed)}.
          </Text>
          {recheck}
        </Group>
      </Stack>
    </Alert>
  );
}
