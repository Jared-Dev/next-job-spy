'use client';

import {
  Anchor,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconExclamationCircle,
  IconRefresh,
  IconSparkles,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { adapter } from '@/lib/storage';
import type { ICvInterviewMessage } from '@/lib/cv/types/ICvInterviewMessage';
import type { ICvStory } from '@/lib/cv/types/ICvStory';
import type { IProfile } from '@/lib/storage/types/IProfile';
import { useModKey } from '@/lib/ui/useModKey';

interface IDistillResponse {
  ready: boolean;
  title: string;
  story: string;
  missing: string;
  filenameOptions: string[];
}

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
 * Full-height chat workspace for the CV interview. Self-contained: owns its
 * chat state, persists transcript on every turn via the adapter, and saves
 * distilled stories straight to the profile.
 *
 * Layout: `display: flex; flex-direction: column; height: 100%`. The chat box
 * inside is `flex: 1`, so the workspace fills whatever vertical space its
 * parent provides. The same component renders inside the modal at
 * `/profile/@modal/(.)story` and on the standalone `/profile/story` page.
 */
export function CvInterviewWorkspace({ profile }: { profile: IProfile }) {
  const transcript = useMemo(
    () => profile.cvInterviewTranscript ?? [],
    [profile.cvInterviewTranscript],
  );

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [distilling, setDistilling] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);
  const mod = useModKey();

  // Every saveProfile in here writes by spreading the latest profile, never a
  // closure-captured snapshot. Without this, a long interview turn (or a
  // post-stream save) could clobber cvStories that were written between
  // handler creation and the actual save, e.g. a story the user just saved or
  // a story added through any other code path that fires a profile refresh.
  const latestProfileRef = useRef(profile);
  useEffect(() => {
    latestProfileRef.current = profile;
  }, [profile]);
  const currentProfile = () => latestProfileRef.current;

  // Direct scrollTop on just the chat container, never scrollIntoView (which
  // can bubble out and yank the outer page). Only pins when the user is at
  // the bottom already, so manual scroll-back to re-read earlier turns isn't
  // fighting the stream.
  useEffect(() => {
    if (!pinnedToBottomRef.current) return;
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [transcript.length, streaming]);

  const handleChatScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedToBottomRef.current = distance < 40;
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || busy) return;

    const userMsg: ICvInterviewMessage = {
      role: 'user',
      content: trimmed,
      at: unixSeconds(),
    };
    const withUser = [...transcript, userMsg];
    await adapter.saveProfile({ ...currentProfile(), cvInterviewTranscript: withUser });
    setInput('');
    setBusy(true);
    setStreaming('');

    let assistantText = '';
    try {
      const response = await fetch('/api/ai/cv-interview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          transcript: withUser,
          message: trimmed,
          profile,
        }),
      });
      if (!response.ok || !response.body) {
        const errBody = await response.text().catch(() => 'Stream failed');
        throw new Error(errBody || `HTTP ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setStreaming(assistantText);
      }
      assistantText += decoder.decode();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stream failed';
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Interview failed',
        message,
      });
      await adapter.saveProfile({ ...currentProfile(), cvInterviewTranscript: transcript });
      setBusy(false);
      setStreaming(null);
      return;
    }

    const finalText = assistantText.trim();
    if (finalText.length > 0) {
      const assistantMsg: ICvInterviewMessage = {
        role: 'assistant',
        content: finalText,
        at: unixSeconds(),
      };
      await adapter.saveProfile({
        ...currentProfile(),
        cvInterviewTranscript: [...withUser, assistantMsg],
      });
    }
    setStreaming(null);
    setBusy(false);
  }, [busy, input, profile, transcript]);

  const handleOpener = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setStreaming('');

    let assistantText = '';
    try {
      const response = await fetch('/api/ai/cv-interview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transcript: [], message: '', profile }),
      });
      if (!response.ok || !response.body) {
        const errBody = await response.text().catch(() => 'Stream failed');
        throw new Error(errBody || `HTTP ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setStreaming(assistantText);
      }
      assistantText += decoder.decode();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stream failed';
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Could not start the interview',
        message,
      });
      setBusy(false);
      setStreaming(null);
      return;
    }

    const finalText = assistantText.trim();
    if (finalText.length > 0) {
      const assistantMsg: ICvInterviewMessage = {
        role: 'assistant',
        content: finalText,
        at: unixSeconds(),
      };
      await adapter.saveProfile({
        ...currentProfile(),
        cvInterviewTranscript: [assistantMsg],
      });
    }
    setStreaming(null);
    setBusy(false);
  }, [busy, profile]);

  const handleHaveOwnStory = useCallback(() => {
    if (busy) return;
    setInput("I already have a story I want to tell. Here it is: ");
    queueMicrotask(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
  }, [busy]);

  const handleSaveStory = useCallback(async () => {
    if (transcript.length < 2 || distilling) return;
    setDistilling(true);
    try {
      const response = await fetch('/api/ai/cv-interview/distill', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      const distilled = (await response.json()) as IDistillResponse;
      const newStory: ICvStory = {
        id: makeStoryId(),
        title: distilled.title || 'Untitled story',
        content: distilled.story,
        createdAt: unixSeconds(),
        source: 'interview',
        filenameOptions: (distilled.filenameOptions ?? []).map((text) => ({
          text,
          selected: true,
        })),
      };
      // Re-read profile + stories at save time (not handler-creation time) so
      // a long distill API call cannot clobber stories added in the interim
      // by any other code path.
      const latest = currentProfile();
      const latestStories = latest.cvStories ?? [];
      await adapter.saveProfile({
        ...latest,
        cvStories: [newStory, ...latestStories],
      });
      notifications.show({
        color: distilled.ready ? 'teal' : 'yellow',
        icon: distilled.ready ? <IconCheck size={18} /> : <IconExclamationCircle size={18} />,
        title: distilled.ready ? 'Story saved' : 'Story saved (needs more)',
        message: distilled.ready
          ? `"${newStory.title}" is now in your story library.`
          : distilled.missing
            ? `Saved as a draft. Still missing: ${distilled.missing}`
            : 'Saved as a draft. The transcript is a little thin, keep going to strengthen it.',
      });
    } catch (err) {
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Could not save story',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setDistilling(false);
    }
  }, [distilling, transcript]);

  const handleResetTranscript = useCallback(async () => {
    if (busy || transcript.length === 0) return;
    await adapter.saveProfile({ ...currentProfile(), cvInterviewTranscript: [] });
  }, [busy, transcript.length]);

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      <Box
        ref={chatRef}
        onScroll={handleChatScroll}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 'var(--mantine-spacing-md)',
        }}
      >
        {transcript.length === 0 && streaming === null ? (
          <Stack
            align="center"
            justify="center"
            gap="sm"
            style={{ minHeight: '100%' }}
          >
            <Button
              size="md"
              leftSection={<IconSparkles size={18} stroke={1.6} />}
              onClick={handleOpener}
              loading={busy}
            >
              Let&apos;s get started
            </Button>
            <Anchor
              component="button"
              type="button"
              size="xs"
              c="dimmed"
              onClick={handleHaveOwnStory}
              disabled={busy}
            >
              Or, I already have a story in mind →
            </Anchor>
          </Stack>
        ) : (
          <Stack gap="sm" maw={780} mx="auto" w="100%">
            {transcript.map((msg, idx) => (
              <ChatBubble key={idx} role={msg.role} content={msg.content} />
            ))}
            {streaming !== null ? (
              <ChatBubble role="assistant" content={streaming} streaming />
            ) : null}
          </Stack>
        )}
      </Box>

      <Box
        style={{
          flex: '0 0 auto',
          borderTop: '1px solid var(--mantine-color-default-border)',
          padding: 'var(--mantine-spacing-md)',
        }}
      >
        <Box maw={780} mx="auto" w="100%">
          <Group gap="sm" align="flex-end" wrap="nowrap">
            <Textarea
              ref={inputRef}
              placeholder="Say what's on your mind. Or just paste a single concrete memory."
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              autosize
              minRows={2}
              maxRows={5}
              style={{ flex: 1 }}
              disabled={busy}
            />
            <Button onClick={handleSend} loading={busy} disabled={!input.trim()}>
              Send
            </Button>
          </Group>
          <Group justify="space-between" mt="xs" gap="xs" wrap="wrap">
            <Text size="xs" c="dimmed" suppressHydrationWarning>
              {mod.label} + Enter to send.
            </Text>
            <Group gap="xs">
              <Tooltip
                label="Clears the chat so you can chase a different angle. Saved stories are kept."
                withArrow
              >
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  leftSection={<IconRefresh size={14} stroke={1.6} />}
                  onClick={handleResetTranscript}
                  disabled={busy || transcript.length === 0}
                >
                  Reset chat
                </Button>
              </Tooltip>
              <Button
                size="xs"
                variant="light"
                color="teal"
                leftSection={<IconCheck size={14} stroke={1.6} />}
                onClick={handleSaveStory}
                loading={distilling}
                disabled={transcript.length < 2}
              >
                Save as story
              </Button>
            </Group>
          </Group>
        </Box>
      </Box>
    </Box>
  );
}

function ChatBubble({
  role,
  content,
  streaming,
}: {
  role: ICvInterviewMessage['role'];
  content: string;
  streaming?: boolean;
}) {
  const isUser = role === 'user';
  return (
    <Group justify={isUser ? 'flex-end' : 'flex-start'} gap={0}>
      <Paper
        withBorder
        radius="md"
        p={10}
        bg={
          isUser
            ? 'var(--mantine-color-indigo-light)'
            : 'var(--mantine-color-default)'
        }
        style={{
          maxWidth: '85%',
          whiteSpace: 'pre-wrap',
          color: 'var(--mantine-color-text)',
        }}
      >
        <Text size="sm" lh={1.5} c="var(--mantine-color-text)">
          {content}
          {streaming ? (
            <Text component="span" c="dimmed">
              ▍
            </Text>
          ) : null}
        </Text>
      </Paper>
    </Group>
  );
}
