'use client';

import {
  Anchor,
  Badge,
  Box,
  Button,
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
  IconExclamationCircle,
  IconHandStop,
  IconSparkles,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { postJson } from '@/lib/ai/postJson';
import { adapter } from '@/lib/storage';
import { ESkillStrength } from '@/lib/storage/types/ESkillStrength';
import type { IJob } from '@/lib/storage/types/IJob';
import type { IProfile } from '@/lib/storage/types/IProfile';

interface IExtractSkillsResponse {
  skills: string[];
  cached: boolean;
}

const STRENGTH_LEVELS: { value: ESkillStrength; label: string }[] = [
  { value: ESkillStrength.Familiar, label: 'Familiar' },
  { value: ESkillStrength.Proficient, label: 'Proficient' },
  { value: ESkillStrength.Advanced, label: 'Advanced' },
  { value: ESkillStrength.Expert, label: 'Expert' },
];

/** Lowercased keys for case-insensitive membership tests. */
function buildKnownKeys(profile: IProfile): Set<string> {
  const keys = new Set<string>();
  for (const s of profile.skills ?? []) {
    if (s.name) keys.add(s.name.toLowerCase());
  }
  for (const name of profile.dismissedSkills ?? []) {
    keys.add(name.toLowerCase());
  }
  return keys;
}

/**
 * On the job page, surfaces skills the posting calls for that the candidate
 * has not yet rated, so they can either add them to the profile with a
 * strength rating or dismiss them once and never be asked again. The list of
 * desired skills is cached on the job after the first extraction.
 */
export function MissingSkillsPanel({ job }: { job: IJob }) {
  const profile = adapter.useProfile();
  const [desired, setDesired] = useState<string[] | null>(
    job.desiredSkills ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-extract once on first open if the cache is empty. Skip silently when
  // there's no description to extract from, render handles that case.
  // State transitions all happen via Promise callbacks (no synchronous setState
  // inside the effect body).
  useEffect(() => {
    if (desired !== null) return;
    if (!job.descriptionMd) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setExtracting(true);
        setError(null);
        return postJson<IExtractSkillsResponse>('/api/ai/extract-skills', {
          jobId: job.id,
        });
      })
      .then((res) => {
        if (cancelled || !res) return;
        setDesired(res.skills);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not extract skills');
        setDesired([]);
      })
      .finally(() => {
        if (!cancelled) setExtracting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job.id, job.descriptionMd, desired]);

  const hasNoDescription = !job.descriptionMd;

  const knownKeys = useMemo(
    () => (profile ? buildKnownKeys(profile) : new Set<string>()),
    [profile],
  );

  const missing = useMemo(() => {
    if (!desired) return [];
    return desired.filter((s) => !knownKeys.has(s.toLowerCase()));
  }, [desired, knownKeys]);

  const rate = useCallback(
    async (name: string, strength: ESkillStrength) => {
      if (!profile) return;
      setBusy(true);
      try {
        const next: IProfile = {
          ...profile,
          skills: [...(profile.skills ?? []), { name, strength }],
        };
        await adapter.saveProfile(next);
        notifications.show({
          color: 'teal',
          icon: <IconCheck size={18} />,
          title: 'Added to your skills',
          message: `${name} (${strength}) is now on your profile.`,
        });
      } catch (err) {
        notifications.show({
          color: 'red',
          icon: <IconExclamationCircle size={18} />,
          title: 'Could not save',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setBusy(false);
      }
    },
    [profile],
  );

  const dismiss = useCallback(
    async (name: string) => {
      if (!profile) return;
      setBusy(true);
      try {
        const lower = name.toLowerCase();
        const prev = profile.dismissedSkills ?? [];
        if (prev.some((n) => n.toLowerCase() === lower)) {
          return;
        }
        const next: IProfile = {
          ...profile,
          dismissedSkills: [...prev, lower],
        };
        await adapter.saveProfile(next);
      } catch (err) {
        notifications.show({
          color: 'red',
          icon: <IconExclamationCircle size={18} />,
          title: 'Could not save',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setBusy(false);
      }
    },
    [profile],
  );

  async function reextract() {
    if (!job.descriptionMd) return;
    setExtracting(true);
    setError(null);
    try {
      const res = await postJson<IExtractSkillsResponse>(
        '/api/ai/extract-skills',
        { jobId: job.id, force: true },
      );
      setDesired(res.skills);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not extract skills');
    } finally {
      setExtracting(false);
    }
  }

  const profileEmpty =
    !profile || (!profile.fullName && (profile.workHistory?.length ?? 0) === 0);

  if (profileEmpty) {
    return (
      <Paper p="lg" withBorder>
        <Group gap="sm" wrap="nowrap" align="center" mb="sm">
          <IconSparkles size={20} stroke={1.6} color="var(--mantine-color-indigo-5)" />
          <Title order={4} fw={600}>
            Skills check
          </Title>
        </Group>
        <Text size="sm" c="dimmed">
          Fill in your profile first. The skills check compares what this job
          asks for against the skills on your profile.
        </Text>
        <Box mt="xs">
          <Anchor href="/profile" size="sm">
            Build profile →
          </Anchor>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper p="lg" withBorder>
      <Group justify="space-between" align="center" mb="sm" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" align="center">
          <IconSparkles size={20} stroke={1.6} color="var(--mantine-color-indigo-5)" />
          <Title order={4} fw={600}>
            Skills check
          </Title>
          {desired ? (
            <Badge size="xs" variant="light" color="indigo">
              {missing.length} new
            </Badge>
          ) : null}
        </Group>
        <Tooltip label="Re-run extraction (costs tokens)" withArrow>
          <Button
            size="xs"
            variant="subtle"
            onClick={reextract}
            loading={extracting}
            disabled={!job.descriptionMd}
          >
            Re-scan
          </Button>
        </Tooltip>
      </Group>

      {hasNoDescription ? (
        <Text size="sm" c="dimmed">
          This job has no description text, so there&apos;s nothing to scan for
          skills.
        </Text>
      ) : null}

      {!hasNoDescription && extracting && desired === null ? (
        <Text size="sm" c="dimmed">
          Reading the job description for skills…
        </Text>
      ) : null}

      {error ? (
        <Text size="sm" c="red">
          {error}
        </Text>
      ) : null}

      {!hasNoDescription && desired !== null && !extracting ? (
        missing.length === 0 ? (
          <Text size="sm" c="dimmed">
            Your profile already covers (or has dismissed) every skill the
            posting calls for. Nothing to add here.
          </Text>
        ) : (
          <Stack gap="xs">
            <Text size="xs" c="dimmed">
              Skills the posting calls for that aren&apos;t on your profile yet.
              Rate one to add it; dismiss to never be asked again.
            </Text>
            {missing.map((skill) => (
              <Group
                key={skill}
                justify="space-between"
                wrap="wrap"
                gap="sm"
                px="sm"
                py={6}
                style={{
                  border: '1px solid var(--mantine-color-default-border)',
                  borderRadius: 'var(--mantine-radius-sm)',
                }}
              >
                <Text size="sm" fw={500}>
                  {skill}
                </Text>
                <Group gap={4} wrap="nowrap">
                  {STRENGTH_LEVELS.map((level) => (
                    <Button
                      key={level.value}
                      size="xs"
                      variant="default"
                      disabled={busy}
                      onClick={() => rate(skill, level.value)}
                    >
                      {level.label}
                    </Button>
                  ))}
                  <Tooltip label="I don't have this, don't ask again" withArrow>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="gray"
                      leftSection={<IconHandStop size={14} stroke={1.6} />}
                      disabled={busy}
                      onClick={() => dismiss(skill)}
                    >
                      Skip
                    </Button>
                  </Tooltip>
                </Group>
              </Group>
            ))}
          </Stack>
        )
      ) : null}
    </Paper>
  );
}
