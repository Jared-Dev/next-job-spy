"use client";

import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Collapse,
  Divider,
  Group,
  List,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconArrowBack,
  IconBook,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconExclamationCircle,
  IconHistory,
  IconInfoCircle,
  IconMail,
  IconFileText,
  IconPin,
  IconPinned,
} from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { hashCoverLetterInputs } from "@/lib/ai/hashInputs";
import { postJson } from "@/lib/ai/postJson";
import { ensureSigned } from "@/lib/coverLetter/ensureSigned";
import { sanitizeForSave } from "@/lib/cv/filenameSanitizer";
import {
  useLocalStoryRanking,
  type TRankStatus,
} from "@/lib/screening/local/useLocalStoryRanking";
import type { ILocalRankItem } from "@/lib/screening/local/types";
import { adapter } from "@/lib/storage";
import { EAnthropicModel } from "@/lib/ai/types/EAnthropicModel";
import type { IGenerateResponse } from "@/lib/ai/types/IGenerateResponse";
import type { ICvStory } from "@/lib/cv/types/ICvStory";
import { EArtifactKind } from "@/lib/storage/types/EArtifactKind";
import type { IArtifact } from "@/lib/storage/types/IArtifact";

import { ArtifactStamp } from "./ArtifactStamp";
import { DirectiveField, COVER_LETTER_DIRECTIVE_HINTS } from "./DirectiveField";
import { TokenEstimate } from "./TokenEstimate";
import { VerificationNotice } from "./VerificationNotice";
import type { ICoverLetterPanelProps } from "./types/ICoverLetterPanelProps";

const COVER_LETTER_MAX_OUTPUT = 800;

/**
 * Sentinel "story" id for the seeded picker option that lets the candidate
 * mark a job as not accepting a cover letter. Lives alongside real stories so
 * it shows up in the same list, but takes a different action branch (sets the
 * job-level flag instead of saving an artifact).
 */
const NO_CL_OPTION_ID = "__no_cover_letter__";

type TMode = "story" | "standard" | "noCoverLetter";

function estimateInputTokens(
  profile: unknown,
  jd: string,
  resume: string,
  story: string,
): number {
  return Math.round(
    (JSON.stringify(profile).length +
      jd.length +
      resume.length +
      story.length) /
      4,
  );
}

/** The pinned artifact, else the newest, artifacts arrive newest-first. */
function pickPrimary(artifacts: IArtifact[]): IArtifact | null {
  return artifacts.find((a) => a.pinned) ?? artifacts[0] ?? null;
}

/** Random pick from the story's selected filename candidates. */
function pickFilenameOverride(story: ICvStory | null): string | undefined {
  if (!story) return undefined;
  const pool = (story.filenameOptions ?? [])
    .filter((o) => o.selected)
    .map((o) => o.text.trim())
    .filter((t) => t.length > 0);
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function CoverLetterPanel({ job }: ICoverLetterPanelProps) {
  const profile = adapter.useProfile();
  const settings = adapter.useSettings();
  const artifacts = adapter.useArtifacts(job.id);
  const [artifactOverride, setArtifactOverride] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [directive, setDirective] = useState("");
  const [directiveOpen, setDirectiveOpen] = useState(false);

  const stories: ICvStory[] = useMemo(
    () => profile?.cvStories ?? [],
    [profile?.cvStories],
  );
  const hasStories = stories.length > 0;

  // Per-job ranking via the local LLM. Driver pauses screening to handle
  // it; falls back to unranked on timeout/failure so the picker is always
  // usable. Skipped entirely when no story library exists or the user has
  // already marked the job as no-CL.
  const ranking = useLocalStoryRanking(
    hasStories && !job.noCoverLetter ? job : null,
    stories,
  );

  // Mode resolution. The candidate sees Story mode by default. Standard mode
  // is only accessible after passing through a warning modal (forceStandard
  // flips to true). It does NOT persist across page reloads on purpose, the
  // warning re-runs each time so the candidate keeps making the choice.
  const [forceStandard, setForceStandard] = useState(false);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [warningOpen, { open: openWarning, close: closeWarning }] =
    useDisclosure(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setStoryId((current) => {
        if (!hasStories) return null;
        return current && stories.some((s) => s.id === current)
          ? current
          : stories[0].id;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [hasStories, stories]);

  const selectedStory = useMemo(
    () => (storyId ? (stories.find((s) => s.id === storyId) ?? null) : null),
    [storyId, stories],
  );

  const coverLetters = useMemo(
    () => (artifacts ?? []).filter((a) => a.kind === EArtifactKind.CoverLetter),
    [artifacts],
  );

  const resumeContext = useMemo(() => {
    const resumes = (artifacts ?? []).filter(
      (a) => a.kind === EArtifactKind.TailoredResume,
    );
    return pickPrimary(resumes)?.content ?? "";
  }, [artifacts]);

  const defaultArtifactId = useMemo<number | null>(() => {
    const primary = pickPrimary(coverLetters);
    return primary && typeof primary.id === "number" ? primary.id : null;
  }, [coverLetters]);

  const currentArtifactId = artifactOverride ?? defaultArtifactId;
  const currentArtifact = useMemo<IArtifact | null>(() => {
    if (currentArtifactId === null) return null;
    return coverLetters.find((a) => a.id === currentArtifactId) ?? null;
  }, [coverLetters, currentArtifactId]);

  const model = settings?.aiModel ?? EAnthropicModel.Sonnet46;
  const inputTokens = profile
    ? estimateInputTokens(
        profile,
        job.descriptionMd ?? "",
        resumeContext,
        selectedStory?.content ?? "",
      )
    : 0;

  // Story mode is the default. Standard only kicks in when the candidate has
  // pushed through the warning modal. We also fall back to standard when the
  // candidate has zero stories AND has confirmed they want to skip, without
  // that confirmation, the panel shows the Build-my-story CTA instead of a
  // Generate button.
  const effectiveMode: TMode | null = forceStandard
    ? "standard"
    : storyId === NO_CL_OPTION_ID
      ? "noCoverLetter"
      : selectedStory
        ? "story"
        : null;

  async function handleGenerate(force = false) {
    if (!profile || !effectiveMode) return;
    // noCoverLetter mode has its own action (handleMarkNoCoverLetter); it
    // should never reach handleGenerate. Narrow the type for the hash call.
    if (effectiveMode === "noCoverLetter") return;
    if (effectiveMode === "story" && !selectedStory) return;
    const trimmedDirective = directive.trim();
    const filenameOverride =
      effectiveMode === "story"
        ? pickFilenameOverride(selectedStory)
        : undefined;

    // hashCoverLetterInputs deliberately does NOT include the random
    // filename pick, only inputs that affect the body. Same body content
    // means the cached artifact's filename is what gets reused.
    const inputHash = hashCoverLetterInputs({
      profile,
      jobDescription: job.descriptionMd ?? "",
      jobTitle: job.title,
      resumeContext,
      model,
      directive: trimmedDirective,
      mode: effectiveMode,
      storyId: selectedStory?.id,
      storyContent: selectedStory?.content,
    });
    if (!force) {
      const cached = coverLetters.find((a) => a.inputHash === inputHash);
      if (cached && typeof cached.id === "number") {
        setArtifactOverride(cached.id);
        notifications.show({
          color: "indigo",
          icon: <IconCheck size={18} />,
          title: "Using existing cover letter",
          message: "Inputs match a previous version.",
        });
        return;
      }
    }
    setBusy(true);
    try {
      // Story mode is pure export: the selected story IS the cover letter.
      // No Claude pass, no token spend, just sign + save. Per-job framing is
      // not added here; the story's voice carries the letter on its own.
      if (effectiveMode === "story" && selectedStory) {
        const candidateName = profile.fullName?.trim() ?? "";
        const content = ensureSigned(selectedStory.content, candidateName);
        const filename = filenameOverride
          ? sanitizeForSave(filenameOverride)
          : sanitizeForSave(`${candidateName || "Cover Letter"}`);
        const id = await adapter.saveArtifact({
          jobId: job.id,
          kind: EArtifactKind.CoverLetter,
          prompt: trimmedDirective || undefined,
          inputHash,
          content,
          filename,
          storyId: selectedStory.id,
          createdAt: Math.floor(Date.now() / 1000),
        });
        setArtifactOverride(id);
        return;
      }

      // Standard mode keeps the Claude pass: a generic professional letter
      // built from profile + JD + tailored resume, no story material.
      const response = await postJson<IGenerateResponse>(
        "/api/ai/cover-letter",
        {
          profile,
          job: {
            title: job.title,
            company: job.company,
            location: job.location,
            description: job.descriptionMd ?? "",
          },
          tailoredResume: resumeContext || undefined,
          model,
          directive: trimmedDirective || undefined,
          mode: effectiveMode,
          filenameOverride,
        },
      );
      const id = await adapter.saveArtifact({
        jobId: job.id,
        kind: EArtifactKind.CoverLetter,
        prompt: trimmedDirective || undefined,
        inputHash,
        content: response.content,
        filename: response.filename,
        usage: response.usage,
        createdAt: Math.floor(Date.now() / 1000),
      });
      setArtifactOverride(id);
    } catch (err) {
      notifications.show({
        color: "red",
        icon: <IconExclamationCircle size={18} />,
        title: effectiveMode === "story" ? "Save failed" : "Generation failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkNoCoverLetter() {
    if (typeof job.id !== "number") return;
    try {
      await adapter.setJobNoCoverLetter(job.id, true);
      notifications.show({
        color: "indigo",
        icon: <IconCheck size={18} />,
        title: "Marked: no cover letter",
        message: `${job.company} doesn't accept a cover letter for this role.`,
      });
    } catch (err) {
      notifications.show({
        color: "red",
        icon: <IconExclamationCircle size={18} />,
        title: "Could not mark job",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  async function handleUndoNoCoverLetter() {
    if (typeof job.id !== "number") return;
    try {
      await adapter.setJobNoCoverLetter(job.id, false);
    } catch (err) {
      notifications.show({
        color: "red",
        icon: <IconExclamationCircle size={18} />,
        title: "Could not undo",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  async function togglePin() {
    if (!currentArtifact || typeof currentArtifact.id !== "number") return;
    await adapter.pinArtifact(currentArtifact.id, !currentArtifact.pinned);
  }

  function openPrint() {
    if (!currentArtifact || typeof currentArtifact.id !== "number") return;
    window.open(
      `/resume/${currentArtifact.id}/print`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function copyText() {
    if (!currentArtifact) return;
    await navigator.clipboard.writeText(currentArtifact.content);
    notifications.show({
      color: "teal",
      icon: <IconCheck size={18} />,
      title: "Copied to clipboard",
      message: "Cover letter text is on your clipboard.",
    });
  }

  function confirmStandard() {
    setForceStandard(true);
    closeWarning();
  }

  function returnToStory() {
    setForceStandard(false);
  }

  const profileEmpty =
    !profile || (!profile.fullName && (profile.workHistory?.length ?? 0) === 0);

  return (
    <Paper p="lg" withBorder>
      <Group gap="sm" wrap="nowrap" align="center" mb="sm">
        <IconMail
          size={20}
          stroke={1.6}
          color="var(--mantine-color-indigo-5)"
        />
        <Title order={4} fw={600}>
          Cover letter
        </Title>
        {coverLetters.length > 0 ? (
          <Badge size="xs" variant="light" color="indigo">
            {coverLetters.length} version{coverLetters.length === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </Group>

      <Alert
        icon={<IconInfoCircle size={16} stroke={1.6} />}
        color="indigo"
        variant="light"
        mb="md"
      >
        <Text size="sm">
          Most cover letters don&apos;t get read, commonly cited surveys put the
          unread share anywhere from 50% to 90%. But in the one-click-apply era,
          sending one still signals effort, and the ones that do get read are
          what separate a candidate from the noise.
        </Text>
      </Alert>

      {profileEmpty ? (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Fill in your profile first. The cover letter is generated from your
            canonical career data.
          </Text>
          <Box>
            <Anchor href="/profile" size="sm">
              Build profile →
            </Anchor>
          </Box>
        </Stack>
      ) : job.noCoverLetter ? (
        <Alert
          color="gray"
          variant="light"
          icon={<IconCheck size={16} stroke={1.6} />}
        >
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Text size="sm">
              Marked: this job doesn&apos;t accept a cover letter.
            </Text>
            <Anchor
              component="button"
              size="xs"
              onClick={() => void handleUndoNoCoverLetter()}
            >
              Undo
            </Anchor>
          </Group>
        </Alert>
      ) : forceStandard ? (
        <StandardMode onBack={returnToStory} showBack={hasStories} />
      ) : hasStories ? (
        <StoryPicker
          stories={stories}
          storyId={storyId}
          onChange={setStoryId}
          rankingStatus={ranking.status}
          rankingItems={ranking.items}
          rankingError={ranking.error}
          onRetryRanking={ranking.retry}
        />
      ) : (
        <BuildMyStoryCallout />
      )}

      {!profileEmpty && !job.noCoverLetter && effectiveMode !== null ? (
        <Stack gap="md" mt="md">
          {effectiveMode === "story" ? (
            <Text size="xs" c="dimmed">
              The selected story is the letter. Export saves it as the
              recruiter-facing PDF; no AI rewrite, no per-job framing added.
            </Text>
          ) : effectiveMode === "noCoverLetter" ? (
            <Text size="xs" c="dimmed">
              No file gets generated; we just record that this posting
              doesn&apos;t take a cover letter.
            </Text>
          ) : (
            <Text size="xs" c="dimmed">
              {resumeContext
                ? "Written from your profile and your latest tailored resume."
                : "Written from your profile. Generate a tailored resume first for tighter alignment."}
            </Text>
          )}

          <Group gap="sm" align="flex-end" wrap="wrap">
            <Group gap={4} wrap="nowrap">
              {effectiveMode === "noCoverLetter" ? (
                <Button
                  onClick={() => void handleMarkNoCoverLetter()}
                  leftSection={<IconCheck size={16} stroke={1.6} />}
                  variant="default"
                >
                  Mark this job as no cover letter
                </Button>
              ) : effectiveMode === "story" ? (
                <Button
                  onClick={() => handleGenerate(currentArtifact != null)}
                  loading={busy}
                  leftSection={<IconMail size={16} stroke={1.6} />}
                >
                  {currentArtifact ? "Re-export" : "Save & export"}
                </Button>
              ) : (
                <Tooltip
                  label="Estimated tokens. Actual cost is stamped on the artifact when the call completes."
                  withArrow
                  multiline
                  w={240}
                >
                  <Button
                    onClick={() => handleGenerate(currentArtifact != null)}
                    loading={busy}
                    leftSection={<IconMail size={16} stroke={1.6} />}
                  >
                    <Group gap={6} wrap="nowrap">
                      <span>{currentArtifact ? "Regenerate" : "Generate"}</span>
                      <TokenEstimate
                        inputTokens={inputTokens}
                        maxOutputTokens={COVER_LETTER_MAX_OUTPUT}
                      />
                    </Group>
                  </Button>
                </Tooltip>
              )}
              {effectiveMode === "noCoverLetter" ? null : (
                <Tooltip
                  label={directiveOpen ? "Hide directive" : "Add a directive"}
                  withArrow
                >
                  <ActionIcon
                    size={36}
                    variant={directiveOpen ? "filled" : "default"}
                    color="indigo"
                    onClick={() => setDirectiveOpen((o) => !o)}
                    aria-label="Add a generation directive"
                  >
                    <IconChevronDown
                      size={16}
                      stroke={1.8}
                      style={{
                        transform: directiveOpen ? "rotate(180deg)" : undefined,
                        transition: "transform 150ms ease",
                      }}
                    />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
            {currentArtifact ? (
              <Group gap="xs">
                <Tooltip
                  label={currentArtifact.pinned ? "Unpin" : "Pin"}
                  withArrow
                >
                  <ActionIcon
                    variant={currentArtifact.pinned ? "filled" : "default"}
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
                  leftSection={<IconFileText size={16} stroke={1.6} />}
                  onClick={openPrint}
                  variant="light"
                >
                  Open as PDF
                </Button>
              </Group>
            ) : null}
          </Group>

          <Collapse expanded={directiveOpen}>
            <DirectiveField
              phrases={COVER_LETTER_DIRECTIVE_HINTS}
              value={directive}
              onChange={setDirective}
            />
          </Collapse>
        </Stack>
      ) : null}

      {currentArtifact ? (
        <Stack gap="sm" mt="md">
          <Divider label="Latest version" labelPosition="left" />
          {currentArtifact.prompt ? (
            <Text size="xs" c="dimmed">
              Directive: {currentArtifact.prompt}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <ArtifactStamp artifact={currentArtifact} />
          </Group>
          <Paper
            p="md"
            withBorder
            bg="var(--mantine-color-gray-0)"
            style={{ maxHeight: 460, overflowY: "auto" }}
          >
            <Text
              size="sm"
              ff="monospace"
              style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}
            >
              {currentArtifact.content}
            </Text>
          </Paper>

          <VerificationNotice artifact={currentArtifact} />
        </Stack>
      ) : null}

      {coverLetters.length > 1 ? (
        <Stack gap="sm" mt="md">
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
                    borderRadius: "var(--mantine-radius-sm)",
                    background: isCurrent
                      ? "var(--mantine-color-indigo-light)"
                      : "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    typeof art.id === "number" && setArtifactOverride(art.id)
                  }
                >
                  <Stack gap={0}>
                    <Text size="xs" fw={500}>
                      {art.prompt ? art.prompt : "Generated"}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {new Date(art.createdAt * 1000).toLocaleString()}
                      {art.pinned ? " · pinned" : ""}
                    </Text>
                  </Stack>
                  <ArtifactStamp artifact={art} compact />
                </Group>
              );
            })}
          </Stack>
        </Stack>
      ) : null}

      {!profileEmpty && !forceStandard ? (
        <Box mt="lg">
          <Anchor component="button" size="xs" c="dimmed" onClick={openWarning}>
            Don&apos;t want to use a story? →
          </Anchor>
        </Box>
      ) : null}

      <StandardWarningModal
        opened={warningOpen}
        onCancel={closeWarning}
        onConfirm={confirmStandard}
      />
    </Paper>
  );
}

function StoryPicker({
  stories,
  storyId,
  onChange,
  rankingStatus,
  rankingItems,
  rankingError,
  onRetryRanking,
}: {
  stories: ICvStory[];
  storyId: string | null;
  onChange: (id: string) => void;
  rankingStatus: TRankStatus;
  rankingItems: ILocalRankItem[] | null;
  rankingError: string | null;
  onRetryRanking: () => void;
}) {
  const story = stories.find((s) => s.id === storyId) ?? null;
  const isNoClSelected = storyId === NO_CL_OPTION_ID;
  const selectedFilenames = useMemo(
    () => (story?.filenameOptions ?? []).filter((o) => o.selected).length,
    [story],
  );

  // Hide the picker while the local model is actively ranking so the
  // candidate doesn't pick before they see the recommended order. The
  // 'timedOut' state still reveals (per the rule: never block selection
  // on ranking).
  const hideForRanking = rankingStatus === "ranking";

  // Order stories by ranking when we have one; rationale lookup keyed by id.
  const rationaleByStoryId = useMemo(() => {
    if (!rankingItems) return new Map<string, string>();
    return new Map(rankingItems.map((i) => [i.storyId, i.why]));
  }, [rankingItems]);

  const orderedStories = useMemo(() => {
    if (!rankingItems || rankingItems.length === 0) return stories;
    const order = new Map(rankingItems.map((item, i) => [item.storyId, i]));
    const indexed = stories.map((s) => ({
      story: s,
      rank: order.get(s.id) ?? Number.POSITIVE_INFINITY,
    }));
    indexed.sort((a, b) => a.rank - b.rank);
    return indexed.map((i) => i.story);
  }, [rankingItems, stories]);

  return (
    <Stack gap="xs">
      <Group gap="xs" align="baseline" justify="space-between">
        <Group gap="xs" align="baseline">
          <Text size="sm" fw={500}>
            Pick a story
          </Text>
          <Anchor component={Link} href="/profile/story" size="xs" c="dimmed">
            Manage stories →
          </Anchor>
        </Group>
        <RankingStatusBadge
          status={rankingStatus}
          onRetry={onRetryRanking}
        />
      </Group>

      {hideForRanking ? (
        <Paper p="lg" withBorder radius="sm" bg="var(--mantine-color-default)">
          <Stack gap="xs" align="center">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Sorting your stories for this role…
            </Text>
            <Text size="xs" c="dimmed">
              Local model only, no tokens spent. We&apos;ll reveal the picker
              shortly even if this takes too long.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <>
          {rankingStatus === "timedOut" ? (
            <Alert
              color="yellow"
              variant="light"
              icon={<IconAlertTriangle size={16} stroke={1.6} />}
              styles={{ message: { fontSize: 12 } }}
            >
              Ranking is taking longer than usual. The picker is unranked for
              now; we&apos;ll re-sort when it finishes.
            </Alert>
          ) : null}
          {rankingStatus === "failed" ? (
            <Alert
              color="yellow"
              variant="light"
              icon={<IconAlertTriangle size={16} stroke={1.6} />}
              styles={{ message: { fontSize: 12 } }}
            >
              Couldn&apos;t sort these for this role
              {rankingError ? ` (${rankingError})` : ""}. Pick any story below
              or{" "}
              <Anchor
                component="button"
                size="xs"
                onClick={onRetryRanking}
              >
                try again
              </Anchor>
              .
            </Alert>
          ) : null}
          <Stack gap={6}>
            {orderedStories.map((s, idx) => {
              const isActive = s.id === storyId;
              const rationale = rationaleByStoryId.get(s.id) ?? "";
              const isTopRanked =
                rankingItems !== null &&
                rankingStatus !== "timedOut" &&
                rankingStatus !== "failed" &&
                idx === 0;
              return (
                <Paper
                  key={s.id}
                  p="sm"
                  withBorder
                  radius="sm"
                  style={{
                    cursor: "pointer",
                    background: isActive
                      ? "var(--mantine-color-indigo-light)"
                      : undefined,
                    borderColor: isActive
                      ? "var(--mantine-color-indigo-6)"
                      : undefined,
                  }}
                  onClick={() => onChange(s.id)}
                >
                  <Group
                    justify="space-between"
                    wrap="nowrap"
                    align="flex-start"
                  >
                    <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                      <Group gap={6} wrap="nowrap" align="center">
                        <Text fw={isActive ? 600 : 500} size="sm" truncate>
                          {s.title}
                        </Text>
                        {isTopRanked ? (
                          <Badge size="xs" variant="light" color="indigo">
                            Recommended
                          </Badge>
                        ) : null}
                      </Group>
                      {rationale ? (
                        <Text size="xs" c="indigo.7" lineClamp={2}>
                          {rationale}
                        </Text>
                      ) : null}
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {s.content}
                      </Text>
                    </Stack>
                    {isActive ? (
                      <IconCheck
                        size={16}
                        stroke={1.8}
                        color="var(--mantine-color-indigo-6)"
                      />
                    ) : null}
                  </Group>
                </Paper>
              );
            })}
        {/* Seeded option pinned at the bottom. Selecting it doesn't pick a
            story for export, it flips the job-level noCoverLetter flag (via
            the action button up in the panel) so we record "this employer
            doesn't take a cover letter" instead of generating a file. */}
        <Paper
          p="sm"
          withBorder
          radius="sm"
          style={{
            cursor: "pointer",
            borderStyle: "dashed",
            background: isNoClSelected
              ? "var(--mantine-color-gray-light)"
              : undefined,
            borderColor: isNoClSelected
              ? "var(--mantine-color-gray-6)"
              : undefined,
          }}
          onClick={() => onChange(NO_CL_OPTION_ID)}
        >
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
              <Text fw={isNoClSelected ? 600 : 500} size="sm">
                This job doesn&apos;t take a cover letter
              </Text>
              <Text size="xs" c="dimmed">
                No file gets generated. We record that this employer
                doesn&apos;t accept one.
              </Text>
            </Stack>
            {isNoClSelected ? (
              <IconCheck
                size={16}
                stroke={1.8}
                color="var(--mantine-color-gray-7)"
              />
            ) : null}
          </Group>
        </Paper>
          </Stack>
        </>
      )}
      {story ? (
        <Text size="xs" c="dimmed">
          {selectedFilenames === 0
            ? "No filenames picked,the model will name the PDF for this story."
            : selectedFilenames === 1
              ? "1 filename selected,it will be used for every export of this story."
              : `${selectedFilenames} filenames selected,one is picked at random per application.`}
        </Text>
      ) : null}
    </Stack>
  );
}

function RankingStatusBadge({
  status,
  onRetry,
}: {
  status: TRankStatus;
  onRetry: () => void;
}) {
  if (status === "ranking") {
    return (
      <Group gap={4} wrap="nowrap">
        <Loader size="xs" />
        <Text size="xs" c="dimmed">
          Sorting…
        </Text>
      </Group>
    );
  }
  if (status === "ready" || status === "cached") {
    return (
      <Text size="xs" c="dimmed">
        Sorted by fit
      </Text>
    );
  }
  if (status === "timedOut" || status === "failed") {
    return (
      <Anchor component="button" size="xs" c="dimmed" onClick={onRetry}>
        Retry sort →
      </Anchor>
    );
  }
  return null;
}

function BuildMyStoryCallout() {
  return (
    <Alert
      icon={<IconBook size={16} stroke={1.6} />}
      color="indigo"
      variant="light"
      title="Build your story first"
    >
      <Stack gap="xs">
        <Text size="sm">
          Cover letters that tell a story land far better than generic ones.
          Spend five minutes on the interview to surface a vignette we can lean
          on, then come back here.
        </Text>
        <Box>
          <Button
            component={Link}
            href="/profile/story"
            leftSection={<IconBook size={16} stroke={1.6} />}
          >
            Build my story
          </Button>
        </Box>
      </Stack>
    </Alert>
  );
}

function StandardMode({
  onBack,
  showBack,
}: {
  onBack: () => void;
  showBack: boolean;
}) {
  return (
    <Alert
      icon={<IconAlertTriangle size={16} stroke={1.6} />}
      color="yellow"
      variant="light"
      title="Standard CV, no story"
    >
      <Stack gap="xs">
        <Text size="sm">
          We&apos;ll write a professional, specific cover letter without
          inventing a story. This is the weaker path; consider going back and
          using a saved story when you can.
        </Text>
        {showBack ? (
          <Box>
            <Button
              size="xs"
              variant="default"
              leftSection={<IconArrowBack size={14} stroke={1.6} />}
              onClick={onBack}
            >
              Back to a story
            </Button>
          </Box>
        ) : (
          <Anchor component={Link} href="/profile/story" size="sm">
            Or build a story first →
          </Anchor>
        )}
      </Stack>
    </Alert>
  );
}

function StandardWarningModal({
  opened,
  onCancel,
  onConfirm,
}: {
  opened: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title="Use a Standard CV?"
      size="md"
      centered
    >
      <Stack gap="md">
        <Alert
          icon={<IconAlertTriangle size={16} stroke={1.6} />}
          color="yellow"
          variant="light"
          title="The double-edged sword"
        >
          <Text size="sm">
            A standard CV is more likely to be opened, then rejected on
            what&apos;s actually in there.
          </Text>
        </Alert>
        <List size="sm" spacing="xs">
          <List.Item>
            A ghosted application never got opened. You don&apos;t know why.
          </List.Item>
          <List.Item>
            A standard CV often gets opened and then declined.
          </List.Item>
          <List.Item>
            A story CV gets opened AND keeps the recruiter reading.
          </List.Item>
        </List>
        <Text size="sm" c="dimmed">
          If you can spare five minutes, the interview is worth it. If you
          can&apos;t, go ahead,but know what you&apos;re trading.
        </Text>
        <Group justify="space-between" mt="sm">
          <Anchor component={Link} href="/profile/story" size="sm" fw={500}>
            Build my story instead →
          </Anchor>
          <Group gap="xs">
            <Button variant="default" onClick={onCancel}>
              Cancel
            </Button>
            <Button color="yellow" variant="light" onClick={onConfirm}>
              Use standard anyway
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
