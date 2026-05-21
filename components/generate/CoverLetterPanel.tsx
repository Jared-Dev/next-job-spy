'use client';

import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconCopy,
  IconExclamationCircle,
  IconHistory,
  IconMail,
  IconPin,
  IconPinned,
  IconPrinter,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

import { hashCoverLetterInputs } from '@/lib/ai/hashInputs';
import { postJson } from '@/lib/ai/postJson';
import { adapter } from '@/lib/storage';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import type { IGenerateResponse } from '@/lib/ai/types/IGenerateResponse';
import { EArtifactKind } from '@/lib/storage/types/EArtifactKind';
import type { IArtifact } from '@/lib/storage/types/IArtifact';

import { ArtifactStamp } from './ArtifactStamp';
import { TokenEstimate } from './TokenEstimate';
import { VerificationNotice } from './VerificationNotice';
import type { ICoverLetterPanelProps } from './types/ICoverLetterPanelProps';

const COVER_LETTER_MAX_OUTPUT = 800;

function estimateInputTokens(profile: unknown, jd: string, resume: string): number {
  // 1 token ≈ 4 chars — close enough for a pre-call estimate.
  return Math.round((JSON.stringify(profile).length + jd.length + resume.length) / 4);
}

/** The pinned artifact, else the newest — artifacts arrive newest-first. */
function pickPrimary(artifacts: IArtifact[]): IArtifact | null {
  return artifacts.find((a) => a.pinned) ?? artifacts[0] ?? null;
}

export function CoverLetterPanel({ job }: ICoverLetterPanelProps) {
  const profile = adapter.useProfile();
  const settings = adapter.useSettings();
  const artifacts = adapter.useArtifacts(job.id);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [artifactOverride, setArtifactOverride] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adapter.hasApiKey().then(setHasApiKey);
  }, []);

  const coverLetters = useMemo(
    () => (artifacts ?? []).filter((a) => a.kind === EArtifactKind.CoverLetter),
    [artifacts],
  );

  // The pinned/newest tailored resume is fed in as context so the letter and
  // the resume tell one consistent story. Server falls back to the raw profile.
  const resumeContext = useMemo(() => {
    const resumes = (artifacts ?? []).filter(
      (a) => a.kind === EArtifactKind.TailoredResume,
    );
    return pickPrimary(resumes)?.content ?? '';
  }, [artifacts]);

  const defaultArtifactId = useMemo<number | null>(() => {
    const primary = pickPrimary(coverLetters);
    return primary && typeof primary.id === 'number' ? primary.id : null;
  }, [coverLetters]);

  const currentArtifactId = artifactOverride ?? defaultArtifactId;
  const currentArtifact = useMemo<IArtifact | null>(() => {
    if (currentArtifactId === null) return null;
    return coverLetters.find((a) => a.id === currentArtifactId) ?? null;
  }, [coverLetters, currentArtifactId]);

  const model = settings?.aiModel ?? EAnthropicModel.Sonnet46;
  const inputTokens = profile
    ? estimateInputTokens(profile, job.descriptionMd ?? '', resumeContext)
    : 0;

  async function handleGenerate() {
    if (!profile) return;
    const inputHash = hashCoverLetterInputs({
      profile,
      jobDescription: job.descriptionMd ?? '',
      jobTitle: job.title,
      resumeContext,
      model,
    });
    const cached = coverLetters.find((a) => a.inputHash === inputHash);
    if (cached && typeof cached.id === 'number') {
      setArtifactOverride(cached.id);
      notifications.show({
        color: 'indigo',
        icon: <IconCheck size={18} />,
        title: 'Using cached cover letter',
        message: 'Inputs match a previous generation; no tokens spent.',
      });
      return;
    }
    setBusy(true);
    try {
      const response = await postJson<IGenerateResponse>('/api/ai/cover-letter', {
        profile,
        job: {
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.descriptionMd ?? '',
        },
        tailoredResume: resumeContext || undefined,
        model,
      });
      const id = await adapter.saveArtifact({
        jobId: job.id,
        kind: EArtifactKind.CoverLetter,
        inputHash,
        content: response.content,
        usage: response.usage,
        createdAt: Math.floor(Date.now() / 1000),
      });
      setArtifactOverride(id);
    } catch (err) {
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Generation failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function togglePin() {
    if (!currentArtifact || typeof currentArtifact.id !== 'number') return;
    await adapter.pinArtifact(currentArtifact.id, !currentArtifact.pinned);
  }

  function openPrint() {
    if (!currentArtifact || typeof currentArtifact.id !== 'number') return;
    window.open(`/r/${currentArtifact.id}/print`, '_blank', 'noopener,noreferrer');
  }

  async function copyText() {
    if (!currentArtifact) return;
    await navigator.clipboard.writeText(currentArtifact.content);
    notifications.show({
      color: 'teal',
      icon: <IconCheck size={18} />,
      title: 'Copied to clipboard',
      message: 'Cover letter text is on your clipboard.',
    });
  }

  const profileEmpty =
    !profile || (!profile.fullName && (profile.workHistory?.length ?? 0) === 0);

  return (
    <Paper p="lg" withBorder>
      <Group gap="sm" wrap="nowrap" align="center" mb="sm">
        <IconMail size={20} stroke={1.6} color="var(--mantine-color-indigo-5)" />
        <Title order={4} fw={600}>
          Cover letter
        </Title>
        {coverLetters.length > 0 ? (
          <Badge size="xs" variant="light" color="indigo">
            {coverLetters.length} version{coverLetters.length === 1 ? '' : 's'}
          </Badge>
        ) : null}
      </Group>

      {profileEmpty ? (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Fill in your profile first — the cover letter is generated from your
            canonical career data.
          </Text>
          <Box>
            <Anchor href="/profile" size="sm">
              Build profile →
            </Anchor>
          </Box>
        </Stack>
      ) : hasApiKey === false ? (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Add your Anthropic API key in Settings to enable generation.
          </Text>
          <Box>
            <Anchor href="/settings" size="sm">
              Open settings →
            </Anchor>
          </Box>
        </Stack>
      ) : (
        <Stack gap="md">
          <Text size="xs" c="dimmed">
            {resumeContext
              ? 'Written from your profile and your latest tailored resume, so the letter and resume stay consistent.'
              : 'Written from your profile. Generate a tailored resume first for a more consistent letter.'}
          </Text>

          <Group gap="sm" align="flex-end" wrap="wrap">
            <Tooltip
              label="Estimated tokens. Actual cost is stamped on the artifact when the call completes."
              withArrow
              multiline
              w={240}
            >
              <Button
                onClick={handleGenerate}
                loading={busy}
                leftSection={<IconMail size={16} stroke={1.6} />}
              >
                <Group gap={6} wrap="nowrap">
                  <span>{currentArtifact ? 'Regenerate' : 'Generate'}</span>
                  <TokenEstimate
                    inputTokens={inputTokens}
                    maxOutputTokens={COVER_LETTER_MAX_OUTPUT}
                  />
                </Group>
              </Button>
            </Tooltip>
            {currentArtifact ? (
              <Group gap="xs">
                <Tooltip label={currentArtifact.pinned ? 'Unpin' : 'Pin'} withArrow>
                  <ActionIcon
                    variant={currentArtifact.pinned ? 'filled' : 'default'}
                    color="indigo"
                    onClick={togglePin}
                    aria-label="Pin"
                  >
                    {currentArtifact.pinned ? (
                      <IconPinned size={16} stroke={1.6} />
                    ) : (
                      <IconPin size={16} stroke={1.6} />
                    )}
                  </ActionIcon>
                </Tooltip>
                <Button
                  variant="default"
                  leftSection={<IconCopy size={16} stroke={1.6} />}
                  onClick={copyText}
                >
                  Copy
                </Button>
                <Button
                  leftSection={<IconPrinter size={16} stroke={1.6} />}
                  onClick={openPrint}
                  variant="light"
                >
                  Print view
                </Button>
              </Group>
            ) : null}
          </Group>

          {currentArtifact ? (
            <>
              <Divider label="Latest version" labelPosition="left" />
              <Group justify="flex-end">
                <ArtifactStamp artifact={currentArtifact} />
              </Group>
              <Paper
                p="md"
                withBorder
                bg="var(--mantine-color-gray-0)"
                style={{ maxHeight: 460, overflowY: 'auto' }}
              >
                <Text
                  size="sm"
                  ff="monospace"
                  style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
                >
                  {currentArtifact.content}
                </Text>
              </Paper>

              <VerificationNotice artifact={currentArtifact} />
            </>
          ) : null}

          {coverLetters.length > 1 ? (
            <>
              <Divider
                label={
                  <Group gap={6}>
                    <IconHistory size={14} stroke={1.6} />
                    <Text size="xs">Version history ({coverLetters.length})</Text>
                  </Group>
                }
                labelPosition="left"
              />
              <Stack gap={6}>
                {coverLetters.map((art) => {
                  const isCurrent = art.id === currentArtifactId;
                  return (
                    <Group
                      key={art.id}
                      justify="space-between"
                      wrap="nowrap"
                      align="center"
                      px="xs"
                      py={6}
                      style={{
                        borderRadius: 'var(--mantine-radius-sm)',
                        background: isCurrent
                          ? 'var(--mantine-color-indigo-light)'
                          : 'transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() =>
                        typeof art.id === 'number' && setArtifactOverride(art.id)
                      }
                    >
                      <Stack gap={0}>
                        <Text size="xs" fw={500}>
                          {new Date(art.createdAt * 1000).toLocaleString()}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {art.pinned ? 'pinned' : 'generated'}
                        </Text>
                      </Stack>
                      <ArtifactStamp artifact={art} compact />
                    </Group>
                  );
                })}
              </Stack>
            </>
          ) : null}
        </Stack>
      )}
    </Paper>
  );
}
