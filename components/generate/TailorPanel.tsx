'use client';

import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Collapse,
  Divider,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconChevronDown,
  IconExclamationCircle,
  IconExternalLink,
  IconHistory,
  IconPin,
  IconPinned,
  IconSparkles,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import { hashTailorInputs } from '@/lib/ai/hashInputs';
import { postJson } from '@/lib/ai/postJson';
import { getTemplate } from '@/lib/resume/templates';
import { rankTemplates } from '@/lib/resume/selectTemplate';
import { adapter } from '@/lib/storage';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import { EArtifactKind } from '@/lib/storage/types/EArtifactKind';
import { ETemplateId } from '@/lib/storage/types/ETemplateId';
import type { IArtifact } from '@/lib/storage/types/IArtifact';
import type { IGenerateResponse } from '@/lib/ai/types/IGenerateResponse';

import { ArtifactStamp } from './ArtifactStamp';
import { DirectiveField, RESUME_DIRECTIVE_HINTS } from './DirectiveField';
import { RefinementBar } from './RefinementBar';
import { TokenEstimate } from './TokenEstimate';
import { VerificationNotice } from './VerificationNotice';
import type { ITailorPanelProps } from './types/ITailorPanelProps';

const TAILOR_MAX_OUTPUT = 2500;

function estimateInputTokens(profile: unknown, jd: string): number {
  // 1 token ≈ 4 chars heuristic — close enough for a pre-call estimate.
  const profileChars = JSON.stringify(profile).length;
  const jdChars = jd.length;
  return Math.round((profileChars + jdChars) / 4);
}

export function TailorPanel({ job }: ITailorPanelProps) {
  const profile = adapter.useProfile();
  const settings = adapter.useSettings();
  const artifacts = adapter.useArtifacts(job.id);
  const [templateOverride, setTemplateOverride] = useState<ETemplateId | null>(null);
  const [artifactOverride, setArtifactOverride] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [directive, setDirective] = useState('');
  const [directiveOpen, setDirectiveOpen] = useState(false);

  const ranked = useMemo(
    () => (profile ? rankTemplates(profile, job.title) : []),
    [profile, job.title],
  );

  const tailoredArtifacts = useMemo(
    () => (artifacts ?? []).filter((a) => a.kind === EArtifactKind.TailoredResume),
    [artifacts],
  );

  const defaultArtifactId = useMemo<number | null>(() => {
    const pinned = tailoredArtifacts.find((a) => a.pinned);
    const newest = pinned ?? tailoredArtifacts[0];
    return newest && typeof newest.id === 'number' ? newest.id : null;
  }, [tailoredArtifacts]);

  const currentArtifactId = artifactOverride ?? defaultArtifactId;

  const currentArtifact = useMemo<IArtifact | null>(() => {
    if (currentArtifactId === null) return null;
    return tailoredArtifacts.find((a) => a.id === currentArtifactId) ?? null;
  }, [tailoredArtifacts, currentArtifactId]);

  const templateId =
    templateOverride ??
    (currentArtifact?.templateId as ETemplateId | undefined) ??
    ranked[0] ??
    ETemplateId.IcTechnical;

  const setTemplateId = (id: ETemplateId) => setTemplateOverride(id);
  const setCurrentArtifactId = (id: number) => setArtifactOverride(id);

  const model = settings?.aiModel ?? EAnthropicModel.Sonnet46;
  const inputTokens = profile
    ? estimateInputTokens(profile, job.descriptionMd ?? '')
    : 0;

  async function handleGenerate(force = false) {
    if (!profile || !templateId) return;
    const trimmedDirective = directive.trim();
    const inputHash = hashTailorInputs({
      profile,
      jobDescription: job.descriptionMd ?? '',
      jobTitle: job.title,
      templateId,
      model,
      directive: trimmedDirective,
    });
    if (!force) {
      const cached = tailoredArtifacts.find((a) => a.inputHash === inputHash);
      if (cached && typeof cached.id === 'number') {
        setCurrentArtifactId(cached.id);
        notifications.show({
          color: 'indigo',
          icon: <IconCheck size={18} />,
          title: 'Using cached resume',
          message: 'Inputs match a previous generation; no tokens spent.',
        });
        return;
      }
    }
    setBusy(true);
    try {
      const response = await postJson<IGenerateResponse>('/api/ai/tailor-resume', {
        profile,
        job: {
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.descriptionMd ?? '',
        },
        templateId,
        model,
        directive: trimmedDirective || undefined,
      });
      const id = await adapter.saveArtifact({
        jobId: job.id,
        kind: EArtifactKind.TailoredResume,
        templateId,
        prompt: trimmedDirective || undefined,
        inputHash,
        content: response.content,
        usage: response.usage,
        createdAt: Math.floor(Date.now() / 1000),
      });
      setCurrentArtifactId(id);
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

  async function handleRefine(instruction: string) {
    if (!profile || !templateId || !currentArtifact) return;
    setBusy(true);
    try {
      const response = await postJson<IGenerateResponse>('/api/ai/refine-resume', {
        profile,
        job: {
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.descriptionMd ?? '',
        },
        templateId,
        baseContent: currentArtifact.content,
        instruction,
        scope: 'whole',
        model,
      });
      const id = await adapter.saveArtifact({
        jobId: job.id,
        parentArtifactId: currentArtifact.id,
        kind: EArtifactKind.TailoredResume,
        templateId,
        prompt: instruction,
        content: response.content,
        usage: response.usage,
        createdAt: Math.floor(Date.now() / 1000),
      });
      setCurrentArtifactId(id);
      notifications.show({
        color: 'teal',
        icon: <IconCheck size={18} />,
        title: 'Refined',
        message: 'New version saved. Old versions remain in the history.',
      });
    } catch (err) {
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Refinement failed',
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

  function openResume() {
    if (!currentArtifact || typeof currentArtifact.id !== 'number') return;
    window.open(
      `/resume/${currentArtifact.id}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  const profileEmpty =
    !profile ||
    (!profile.fullName && (profile.workHistory?.length ?? 0) === 0);

  return (
    <Paper p="lg" withBorder>
      <Group justify="space-between" align="flex-start" wrap="nowrap" mb="sm">
        <Group gap="sm" wrap="nowrap" align="center">
          <IconSparkles size={20} stroke={1.6} color="var(--mantine-color-indigo-5)" />
          <Title order={4} fw={600}>
            Tailor resume
          </Title>
          {tailoredArtifacts.length > 0 ? (
            <Badge size="xs" variant="light" color="indigo">
              {tailoredArtifacts.length} version
              {tailoredArtifacts.length === 1 ? '' : 's'}
            </Badge>
          ) : null}
        </Group>
      </Group>

      {profileEmpty ? (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Fill in your profile first — the tailoring engine generates from your
            canonical career data.
          </Text>
          <Box>
            <Anchor href="/profile" size="sm">
              Build profile →
            </Anchor>
          </Box>
        </Stack>
      ) : (
        <Stack gap="md">
          <Group gap="sm" align="flex-end" wrap="wrap">
            <Select
              label="Template"
              description="Sorted by fit for this job and your profile; the top option is recommended."
              data={ranked.map((id) => {
                const t = getTemplate(id);
                return { value: t.id, label: `${t.label}: ${t.bestFor}` };
              })}
              value={templateId ?? ''}
              onChange={(v) => setTemplateId((v as ETemplateId) || ETemplateId.IcTechnical)}
              w={360}
            />
            <Group gap={4} wrap="nowrap">
              <Tooltip
                label="Estimated tokens. Actual cost is stamped on the artifact when the call completes."
                withArrow
                multiline
                w={240}
              >
                <Button
                  onClick={() => handleGenerate(currentArtifact != null)}
                  loading={busy}
                  disabled={!templateId}
                  leftSection={<IconSparkles size={16} stroke={1.6} />}
                >
                  <Group gap={6} wrap="nowrap">
                    <span>{currentArtifact ? 'Regenerate' : 'Generate'}</span>
                    <TokenEstimate
                      inputTokens={inputTokens}
                      maxOutputTokens={TAILOR_MAX_OUTPUT}
                    />
                  </Group>
                </Button>
              </Tooltip>
              <Tooltip
                label={directiveOpen ? 'Hide directive' : 'Add a directive'}
                withArrow
              >
                <ActionIcon
                  size={36}
                  variant={directiveOpen ? 'filled' : 'default'}
                  color="indigo"
                  onClick={() => setDirectiveOpen((o) => !o)}
                  disabled={!templateId}
                  aria-label="Add a generation directive"
                >
                  <IconChevronDown
                    size={16}
                    stroke={1.8}
                    style={{
                      transform: directiveOpen ? 'rotate(180deg)' : undefined,
                      transition: 'transform 150ms ease',
                    }}
                  />
                </ActionIcon>
              </Tooltip>
            </Group>
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
                  leftSection={<IconExternalLink size={16} stroke={1.6} />}
                  onClick={openResume}
                  variant="light"
                >
                  Open resume
                </Button>
              </Group>
            ) : null}
          </Group>

          <Collapse expanded={directiveOpen}>
            <DirectiveField
              phrases={RESUME_DIRECTIVE_HINTS}
              value={directive}
              onChange={setDirective}
            />
          </Collapse>

          {currentArtifact ? (
            <>
              <Divider label="Latest version" labelPosition="left" />
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={2}>
                  <Text size="xs" c="dimmed">
                    Template: {currentArtifact.templateId}
                  </Text>
                  {currentArtifact.prompt ? (
                    <Text size="xs" c="dimmed">
                      Directive: {currentArtifact.prompt}
                    </Text>
                  ) : null}
                </Stack>
                <ArtifactStamp artifact={currentArtifact} />
              </Group>
              <VerificationNotice artifact={currentArtifact} />

              <Divider label="Refine without regenerating from scratch" labelPosition="left" />
              <RefinementBar onSubmit={handleRefine} busy={busy} disabled={!templateId} />
            </>
          ) : null}

          {tailoredArtifacts.length > 1 ? (
            <>
              <Divider
                label={
                  <Group gap={6}>
                    <IconHistory size={14} stroke={1.6} />
                    <Text size="xs">Version history ({tailoredArtifacts.length})</Text>
                  </Group>
                }
                labelPosition="left"
              />
              <Stack gap={6}>
                {tailoredArtifacts.map((art) => {
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
                      onClick={() => typeof art.id === 'number' && setCurrentArtifactId(art.id)}
                    >
                      <Stack gap={0}>
                        <Text size="xs" fw={500}>
                          {art.prompt ? art.prompt : 'Initial generation'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {new Date(art.createdAt * 1000).toLocaleString()}
                          {art.pinned ? ' · pinned' : ''}
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
