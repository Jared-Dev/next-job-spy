'use client';

import {
  Accordion,
  Anchor,
  Badge,
  Button,
  Group,
  NumberInput,
  PasswordInput,
  Paper,
  Select,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconExclamationCircle,
  IconSparkles,
} from '@tabler/icons-react';
import { useEffect, useState, useTransition } from 'react';

import { adapter } from '@/lib/storage';
import type { ISettings } from '@/lib/storage/types/ISettings';

import type { ISettingsFormProps } from './types/ISettingsFormProps';

const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (recommended)' },
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (fastest, cheapest)' },
];

export function SettingsForm(_props: ISettingsFormProps) {
  const settings = adapter.useSettings();
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    adapter.hasApiKey().then((present) => {
      if (!cancelled) setHasApiKey(present);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!settings || hasApiKey === null) {
    return (
      <Stack gap="md">
        <Skeleton height={36} />
        <Skeleton height={36} />
        <Skeleton height={36} />
      </Stack>
    );
  }

  return <SettingsFormInner settings={settings} hasApiKey={hasApiKey} />;
}

function SettingsFormInner({
  settings,
  hasApiKey,
}: {
  settings: ISettings;
  hasApiKey: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [showKeyInput, setShowKeyInput] = useState(!hasApiKey);
  const [keyPresent, setKeyPresent] = useState(hasApiKey);

  const form = useForm({
    initialValues: {
      anthropicApiKey: '',
      model: settings.aiModel,
      maxTokens: settings.aiMaxTokens,
      autoRefreshIntervalMin: String(settings.autoRefreshIntervalMin ?? 0),
    },
    validate: {
      model: (v) => (v ? null : 'Pick a model'),
      maxTokens: (v) => (v && v > 0 ? null : 'Must be positive'),
    },
  });

  return (
    <form
      onSubmit={form.onSubmit((values) => {
        startTransition(async () => {
          try {
            if (values.anthropicApiKey && values.anthropicApiKey.trim().length > 0) {
              await adapter.setApiKey(values.anthropicApiKey.trim());
              setKeyPresent(true);
              setShowKeyInput(false);
              form.setFieldValue('anthropicApiKey', '');
            }
            await adapter.saveSettings({
              aiModel: values.model,
              aiMaxTokens: values.maxTokens,
              autoRefreshIntervalMin:
                Number.parseInt(values.autoRefreshIntervalMin, 10) || 0,
            });
            notifications.show({
              color: 'teal',
              icon: <IconCheck size={18} />,
              title: 'Settings saved',
              message: 'Your changes are live.',
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            notifications.show({
              color: 'red',
              icon: <IconExclamationCircle size={18} />,
              title: 'Could not save',
              message,
            });
          }
        });
      })}
    >
      <Stack gap="lg">
        <SubscriptionAuthNotice keyPresent={keyPresent} />

        <Accordion variant="separated" radius="md">
          <Accordion.Item value="api-key">
            <Accordion.Control>
              <Group gap="xs">
                <Text size="sm" fw={500}>
                  API key fallback
                </Text>
                {keyPresent ? (
                  <Badge size="xs" variant="light" color="gray">
                    Set
                  </Badge>
                ) : null}
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <ApiKeyBlock
                showInput={showKeyInput}
                setShowInput={setShowKeyInput}
                keyPresent={keyPresent}
                value={form.values.anthropicApiKey}
                onChange={(v) => form.setFieldValue('anthropicApiKey', v)}
              />
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>

        <Select
          label="Model"
          description="Suggested model when invoking Claude Code. Claude Code may override based on your subscription tier."
          data={MODEL_OPTIONS}
          {...form.getInputProps('model')}
        />

        <NumberInput
          label="Max tokens per response"
          description="Hard ceiling. Per-route handlers pick lower defaults appropriate to the task."
          min={256}
          max={200_000}
          step={1024}
          {...form.getInputProps('maxTokens')}
        />

        <Select
          label="Auto-refresh sources"
          description="Background refresh of enabled sources while the app is open. Skipped when the tab is hidden."
          data={[
            { value: '0', label: 'Off (manual only)' },
            { value: '15', label: 'Every 15 minutes' },
            { value: '30', label: 'Every 30 minutes' },
            { value: '60', label: 'Every hour' },
            { value: '240', label: 'Every 4 hours' },
          ]}
          {...form.getInputProps('autoRefreshIntervalMin')}
        />

        <Group justify="flex-end">
          <Button type="submit" loading={isPending}>
            Save settings
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function SubscriptionAuthNotice({ keyPresent }: { keyPresent: boolean }) {
  return (
    <Paper p="md" withBorder bg="var(--mantine-color-indigo-light)">
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <ThemeIcon variant="light" color="indigo" size="lg">
          <IconSparkles size={18} stroke={1.6} />
        </ThemeIcon>
        <Stack gap={4}>
          <Text fw={600} size="sm">
            AI runs on your Claude subscription
          </Text>
          <Text size="sm" c="dimmed">
            Every AI call goes through the Claude Code CLI on this machine,
            drawing from your Pro/Max quota. No API billing. Make sure
            you&apos;ve run{' '}
            <Text component="span" ff="monospace" size="sm">
              claude login
            </Text>{' '}
            in a terminal at least once.
          </Text>
          <Text size="xs" c="dimmed">
            {keyPresent
              ? 'An API key fallback is configured for when your subscription rate-limits.'
              : 'Optionally add an API key fallback below for when your subscription rate-limits.'}
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}

interface IApiKeyBlockProps {
  showInput: boolean;
  setShowInput: (v: boolean) => void;
  keyPresent: boolean;
  value: string;
  onChange: (v: string) => void;
}

function ApiKeyBlock({
  showInput,
  setShowInput,
  keyPresent,
  value,
  onChange,
}: IApiKeyBlockProps) {
  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Text fw={500} size="sm">
          Anthropic API key
        </Text>
        {keyPresent && !showInput ? (
          <Anchor
            component="button"
            type="button"
            size="sm"
            onClick={() => setShowInput(true)}
          >
            Replace key
          </Anchor>
        ) : null}
      </Group>

      {showInput ? (
        <PasswordInput
          placeholder="sk-ant-…"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      ) : (
        <Text size="sm" c="dimmed">
          {keyPresent ? 'A key is configured.' : 'No key configured.'}
        </Text>
      )}
      <Text size="xs" c="dimmed">
        Optional. Used only if your Claude subscription rate-limits. Get a key at{' '}
        <Anchor href="https://console.anthropic.com/" target="_blank" rel="noreferrer">
          console.anthropic.com
        </Anchor>
        . Stored in your local SQLite database.
      </Text>
    </Stack>
  );
}
