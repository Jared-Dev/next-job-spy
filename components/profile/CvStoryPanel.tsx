'use client';

import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  Pill,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconArrowRight,
  IconEye,
  IconMessageCircle,
  IconPencil,
  IconPlus,
  IconSparkles,
  IconTrash,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { sanitizeStem } from '@/lib/cv/filenameSanitizer';
import { adapter } from '@/lib/storage';
import type { ICvStory } from '@/lib/cv/types/ICvStory';
import type { IProfile } from '@/lib/storage/types/IProfile';

import { StoryPreviewModal } from './StoryPreviewModal';

function unixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function makeStoryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * /profile section for CV story management. The interview chat itself lives
 * at `/profile/story` (opens as a modal over /profile via the intercepting
 * route, or as a standalone page on direct nav / refresh / hard link), so
 * this panel is purely:
 *   - the intro / motivation copy
 *   - the "Start" or "Continue" CTA into the workspace
 *   - the saved-stories list (with edit / rename / delete / filename options)
 *   - the "Write manually" path that opens the editor modal in place
 */
export function CvStoryPanel({ profile }: { profile: IProfile }) {
  const stories = useMemo(() => profile.cvStories ?? [], [profile.cvStories]);
  const transcriptLength = profile.cvInterviewTranscript?.length ?? 0;

  const editor = useEditorDisclosure();
  const [previewStory, setPreviewStory] = useState<ICvStory | null>(null);
  const candidateName = profile.fullName?.trim() || 'Candidate';

  // Every saveProfile call here reads from this ref instead of closure
  // `profile` so concurrent writes (e.g. the interview modal saving a story
  // while a filename pill update is in flight) can't clobber each other's
  // unrelated fields.
  const latestProfileRef = useRef(profile);
  useEffect(() => {
    latestProfileRef.current = profile;
  }, [profile]);

  const handleDeleteStory = useCallback(async (id: string) => {
    const latest = latestProfileRef.current;
    const currentStories = latest.cvStories ?? [];
    await adapter.saveProfile({
      ...latest,
      cvStories: currentStories.filter((s) => s.id !== id),
    });
  }, []);

  const handleUpsertStory = useCallback(async (story: ICvStory) => {
    const latest = latestProfileRef.current;
    const currentStories = latest.cvStories ?? [];
    const exists = currentStories.some((s) => s.id === story.id);
    const nextStories = exists
      ? currentStories.map((s) => (s.id === story.id ? story : s))
      : [story, ...currentStories];
    await adapter.saveProfile({ ...latest, cvStories: nextStories });
  }, []);

  const startLabel =
    transcriptLength > 0 ? 'Continue interview' : "Start the interview";

  return (
    <Paper id="story" p="lg" withBorder>
      <Group gap="sm" wrap="nowrap" align="center" mb="xs">
        <IconSparkles size={20} stroke={1.6} color="var(--mantine-color-indigo-5)" />
        <Title order={3} fw={600}>
          Your story
        </Title>
        {stories.length > 0 ? (
          <Badge variant="light" color="indigo" size="sm">
            {stories.length} saved
          </Badge>
        ) : null}
      </Group>
      <Text size="sm" c="dimmed" mb="md" maw={700}>
        Cover letters land when they tell a story. You sit down with a
        marketer-style interviewer who pulls a real moment out of you, then
        we shape it into something a recruiter can&apos;t put down. You have
        final say on every word. Save as many stories as you want, and pick
        the right one per job.
      </Text>

      <Group gap="sm" mb="lg">
        <Button
          component={Link}
          href="/profile/story"
          scroll={false}
          leftSection={<IconMessageCircle size={16} stroke={1.6} />}
          rightSection={<IconArrowRight size={14} stroke={1.6} />}
        >
          {startLabel}
        </Button>
        <Button
          variant="default"
          leftSection={<IconPlus size={16} stroke={1.6} />}
          onClick={() => editor.openNew()}
        >
          Write a story manually
        </Button>
      </Group>

      <Divider label="Saved stories" labelPosition="left" my="lg" />

      {stories.length === 0 ? (
        <Text size="sm" c="dimmed">
          No saved stories yet. Run the interview, or{' '}
          <Anchor component="button" onClick={() => editor.openNew()}>
            write one by hand
          </Anchor>
          .
        </Text>
      ) : (
        <Stack gap="sm">
          {stories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              onUpdate={handleUpsertStory}
              onPreview={() => setPreviewStory(story)}
              onEdit={() => editor.openEdit(story)}
              onDelete={() => void handleDeleteStory(story.id)}
            />
          ))}
        </Stack>
      )}

      <StoryEditorModal
        opened={editor.opened}
        story={editor.story}
        onClose={editor.close}
        onSave={async (story) => {
          await handleUpsertStory(story);
          editor.close();
        }}
      />

      <StoryPreviewModal
        opened={previewStory !== null}
        story={previewStory}
        candidateName={candidateName}
        onClose={() => setPreviewStory(null)}
        onEdit={() => {
          if (!previewStory) return;
          const story = previewStory;
          setPreviewStory(null);
          editor.openEdit(story);
        }}
      />
    </Paper>
  );
}

function StoryCard({
  story,
  onUpdate,
  onPreview,
  onEdit,
  onDelete,
}: {
  story: ICvStory;
  onUpdate: (story: ICvStory) => Promise<void> | void;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Anything still flagged `selected: false` from an older build is treated as
  // removed (the new UI has no toggle, just a remove button). Filtering here
  // keeps the pool consumer in CoverLetterPanel honest without a data migration.
  const options = useMemo(
    () => (story.filenameOptions ?? []).filter((o) => o.selected !== false),
    [story.filenameOptions],
  );
  const [adding, setAdding] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const removeOption = (index: number) => {
    const next = options.filter((_, i) => i !== index);
    void onUpdate({ ...story, filenameOptions: next });
  };

  const addOption = () => {
    const text = sanitizeStem(adding);
    if (!text) return;
    if (options.some((o) => o.text.toLowerCase() === text.toLowerCase())) {
      setAdding('');
      return;
    }
    void onUpdate({
      ...story,
      filenameOptions: [...options, { text, selected: true }],
    });
    setAdding('');
  };

  const suggestFilenames = async () => {
    setSuggesting(true);
    setSuggestError(null);
    try {
      const res = await fetch('/api/ai/cv-filenames', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ story: story.content, title: story.title }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as { filenames: string[] };
      const existing = new Set(options.map((o) => o.text.toLowerCase()));
      const merged = [...options];
      for (const raw of data.filenames) {
        const text = sanitizeStem(raw);
        const key = text.toLowerCase();
        if (!text || existing.has(key)) continue;
        existing.add(key);
        merged.push({ text, selected: true });
      }
      await onUpdate({ ...story, filenameOptions: merged });
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'Could not generate filenames');
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <Paper p="sm" withBorder radius="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
          <Group gap="xs" wrap="nowrap">
            <Text fw={600} size="sm" truncate>
              {story.title}
            </Text>
            {story.source === 'interview' ? (
              <Badge size="xs" variant="light" color="indigo">
                Interview
              </Badge>
            ) : (
              <Badge size="xs" variant="light" color="gray">
                Manual
              </Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed" lineClamp={3}>
            {story.content}
          </Text>
        </Stack>
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Preview as PDF" withArrow>
            <ActionIcon variant="subtle" onClick={onPreview} aria-label="Preview story as PDF">
              <IconEye size={16} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Edit" withArrow>
            <ActionIcon variant="subtle" onClick={onEdit} aria-label="Edit story">
              <IconPencil size={16} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete" withArrow>
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={onDelete}
              aria-label="Delete story"
            >
              <IconTrash size={16} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Divider my="xs" />

      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap" align="center">
          <Text size="xs" fw={500} c="dimmed">
            Filenames
            {options.length > 0 ? (
              <Text component="span" c="dimmed">
                {' '}
                ({options.length} in the pool, one is picked at random per job)
              </Text>
            ) : null}
          </Text>
          <Tooltip label="Suggest 5 filenames from this story" withArrow>
            <Button
              size="compact-xs"
              variant="subtle"
              color="indigo"
              leftSection={<IconSparkles size={14} stroke={1.6} />}
              loading={suggesting}
              onClick={() => void suggestFilenames()}
            >
              Suggest
            </Button>
          </Tooltip>
        </Group>

        {options.length > 0 ? (
          <Pill.Group>
            {options.map((opt, i) => (
              <Pill
                key={`${opt.text}-${i}`}
                size="sm"
                withRemoveButton
                onRemove={() => removeOption(i)}
                removeButtonProps={{ 'aria-label': `Remove ${opt.text}` }}
              >
                {opt.text}.pdf
              </Pill>
            ))}
          </Pill.Group>
        ) : (
          <Text size="xs" c="dimmed">
            No filenames yet. Hit Suggest to have the AI pull 5 from this
            story, or type your own below.
          </Text>
        )}

        {suggestError ? (
          <Text size="xs" c="red.6">
            {suggestError}
          </Text>
        ) : null}

        <Group gap="xs" wrap="nowrap" mt={4}>
          <TextInput
            size="xs"
            placeholder={`Type your own, e.g. "I can't turn it off"`}
            value={adding}
            onChange={(e) => setAdding(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addOption();
              }
            }}
            style={{ flex: 1 }}
          />
          <Button
            size="xs"
            variant="default"
            onClick={addOption}
            disabled={sanitizeStem(adding).length === 0}
          >
            Add
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

interface IEditorDisclosure {
  opened: boolean;
  story: ICvStory | null;
  openNew: () => void;
  openEdit: (story: ICvStory) => void;
  close: () => void;
}

function useEditorDisclosure(): IEditorDisclosure {
  const [opened, { open, close }] = useDisclosure(false);
  const [story, setStory] = useState<ICvStory | null>(null);
  return useMemo(
    () => ({
      opened,
      story,
      openNew: () => {
        setStory(null);
        open();
      },
      openEdit: (s) => {
        setStory(s);
        open();
      },
      close: () => {
        close();
        setStory(null);
      },
    }),
    [opened, story, open, close],
  );
}

function StoryEditorModal({
  opened,
  story,
  onClose,
  onSave,
}: {
  opened: boolean;
  story: ICvStory | null;
  onClose: () => void;
  onSave: (story: ICvStory) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setTitle(story?.title ?? '');
      setContent(story?.content ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [opened, story]);

  const canSave = title.trim().length > 0 && content.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const next: ICvStory = {
        id: story?.id ?? makeStoryId(),
        title: title.trim(),
        content: content.trim(),
        createdAt: story?.createdAt ?? unixSeconds(),
        source: story?.source ?? 'manual',
      };
      await onSave(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={story ? 'Edit story' : 'Write a story'}
      size="lg"
    >
      <Stack gap="sm">
        <TextInput
          label="Title"
          placeholder='Short and concrete, e.g. "The chemistry teacher"'
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
        <Textarea
          label="Story"
          description="In your voice. A specific scene plus what you took from it."
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          autosize
          minRows={6}
          maxRows={18}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!canSave}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
