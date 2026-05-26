'use client';

import {
  Accordion,
  Anchor,
  Badge,
  Button,
  Divider,
  Group,
  MultiSelect,
  NumberInput,
  PasswordInput,
  Paper,
  Select,
  Skeleton,
  Stack,
  Switch,
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

import { COMMON_LANGUAGE_OPTIONS } from '@/lib/jobs/detectLanguage';
import {
  checkWebGpuCapability,
  type IGpuCheckResult,
} from '@/lib/screening/local/gpuCheck';
import { suggestParallelism } from '@/lib/screening/local/suggestParallelism';
import { adapter } from '@/lib/storage';
import { ELocalModelVariant } from '@/lib/storage/types/ELocalModelVariant';
import { EVerificationMode } from '@/lib/storage/types/EVerificationMode';
import type { ISettings } from '@/lib/storage/types/ISettings';

import { ScreeningStatsPanel } from './ScreeningStatsPanel';
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
  const [gpu, setGpu] = useState<IGpuCheckResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void checkWebGpuCapability().then((result) => {
      if (!cancelled) setGpu(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const variantOptions: { value: ELocalModelVariant; label: string }[] = [
    {
      value: ELocalModelVariant.Smaller,
      label:
        gpu?.status === 'capable_low'
          ? 'Smaller · ~900MB (recommended for your GPU)'
          : 'Smaller · ~900MB',
    },
    {
      value: ELocalModelVariant.Stronger,
      label:
        gpu?.status === 'capable_high' || gpu === null
          ? 'Stronger · ~2.3GB (recommended)'
          : 'Stronger · ~2.3GB',
    },
  ];

  const form = useForm({
    initialValues: {
      anthropicApiKey: '',
      model: settings.aiModel,
      maxTokens: settings.aiMaxTokens,
      autoRefreshIntervalMin: String(settings.autoRefreshIntervalMin ?? 0),
      aiImportFallback: settings.aiImportFallback ?? true,
      verificationMode: settings.verificationMode ?? EVerificationMode.Thorough,
      crossCheckNumbers: settings.crossCheckNumbers ?? true,
      screeningEmbeddingEnabled: settings.screeningEmbeddingEnabled ?? true,
      screeningLocalEnabled: settings.screeningLocalEnabled ?? true,
      screeningEmbeddingThreshold:
        settings.screeningEmbeddingThreshold ?? 0.3,
      screeningLocalModelVariant:
        settings.screeningLocalModelVariant ?? ELocalModelVariant.Stronger,
      screeningAutoTuneEnabled: settings.screeningAutoTuneEnabled ?? true,
      screeningAutoTuneMinVerdicts:
        settings.screeningAutoTuneMinVerdicts ?? 100,
      screeningLocalParallelism: String(
        settings.screeningLocalParallelism ?? 1,
      ),
      allowedLanguages:
        settings.allowedLanguages && settings.allowedLanguages.length > 0
          ? settings.allowedLanguages
          : ['eng'],
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
              aiImportFallback: values.aiImportFallback,
              verificationMode: values.verificationMode,
              crossCheckNumbers: values.crossCheckNumbers,
              screeningEmbeddingEnabled: values.screeningEmbeddingEnabled,
              screeningLocalEnabled: values.screeningLocalEnabled,
              screeningEmbeddingThreshold: values.screeningEmbeddingThreshold,
              screeningLocalModelVariant: values.screeningLocalModelVariant,
              screeningAutoTuneEnabled: values.screeningAutoTuneEnabled,
              screeningAutoTuneMinVerdicts:
                values.screeningAutoTuneMinVerdicts,
              screeningLocalParallelism: Number.parseInt(
                values.screeningLocalParallelism,
                10,
              ),
              allowedLanguages:
                values.allowedLanguages.length > 0
                  ? values.allowedLanguages
                  : ['eng'],
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

        <Switch
          label="AI-assisted job import"
          description="When you add a job by URL, fall back to a Claude extraction pass if the page can't be read directly. Runs on your Claude subscription."
          {...form.getInputProps('aiImportFallback', { type: 'checkbox' })}
        />

        <Select
          label="Fabrication check"
          description="Generated resumes and cover letters are checked against your profile for invented facts before you send them."
          data={[
            {
              value: EVerificationMode.Thorough,
              label: 'Thorough — always verify with the stronger model',
            },
            {
              value: EVerificationMode.Fast,
              label: 'Fast — quick model first, escalate when risk is detected',
            },
          ]}
          {...form.getInputProps('verificationMode')}
        />

        <Switch
          label="Cross-check numbers"
          description="Flag any number in generated content that isn't in your profile — a free check that runs regardless of the model."
          {...form.getInputProps('crossCheckNumbers', { type: 'checkbox' })}
        />

        <Divider
          label={
            <Text size="xs" fw={600} c="dimmed" tt="uppercase">
              Job screening
            </Text>
          }
          labelPosition="left"
        />

        <Text size="sm" c="dimmed">
          Cascade filters that run before Claude scores a job. Each stage is
          optional and free. See stats below for how much each is filtering.
        </Text>

        <MultiSelect
          label="Allowed languages"
          description="Postings detected in any other language are dropped at ingest, before embedding or local screening runs against text you can't read. Changes apply to new jobs only; existing rejected jobs stay rejected."
          data={[...COMMON_LANGUAGE_OPTIONS]}
          searchable
          clearable={false}
          {...form.getInputProps('allowedLanguages')}
        />

        <Switch
          label="Embedding pre-filter"
          description="Server-side topical similarity vs your profile, runs at job ingest. Catches obvious wrong-field mismatches. ~33MB model, milliseconds per job."
          {...form.getInputProps('screeningEmbeddingEnabled', { type: 'checkbox' })}
        />

        <Switch
          label="Auto-tune embedding threshold"
          description="Learns the right threshold from local LLM verdicts. Batch size starts small and grows as the threshold stabilizes; once stable, both update on every verdict. Off = you set the threshold manually."
          {...form.getInputProps('screeningAutoTuneEnabled', { type: 'checkbox' })}
        />

        {form.values.screeningAutoTuneEnabled ? (
          <NumberInput
            label="Verdicts before auto-tune settles"
            description="Minimum local verdicts the algorithm needs before it can declare convergence and open the embedding batch to full size. Higher = more conservative; lower = ramps faster but risks declaring 'stable' on thin data. Default 100."
            min={10}
            max={10_000}
            step={10}
            {...form.getInputProps('screeningAutoTuneMinVerdicts')}
          />
        ) : null}

        <NumberInput
          label={
            form.values.screeningAutoTuneEnabled ? (
              <Group gap={6}>
                <span>Embedding threshold</span>
                <Badge size="xs" variant="light" color="indigo">
                  managed by auto-tune
                </Badge>
              </Group>
            ) : (
              'Embedding threshold'
            )
          }
          description={
            form.values.screeningAutoTuneEnabled
              ? "Auto-tune updates this after every local verdict. Turn the toggle off to set it yourself."
              : "Cosine similarity floor for the embedding screen. Lower = more permissive (more jobs pass through to Claude)."
          }
          min={0}
          max={1}
          step={0.05}
          decimalScale={2}
          fixedDecimalScale
          disabled={
            !form.values.screeningEmbeddingEnabled ||
            form.values.screeningAutoTuneEnabled
          }
          {...form.getInputProps('screeningEmbeddingThreshold')}
        />

        <Switch
          label="Local LLM screen"
          description="Browser Web Worker reasoning gate. Runs in the tab while you work, catching misfits embeddings miss (clearance, location, requirements). Runs on your GPU."
          {...form.getInputProps('screeningLocalEnabled', { type: 'checkbox' })}
        />

        {form.values.screeningLocalEnabled ? (
          <Select
            label="Local model size"
            description={describeGpuRecommendation(gpu)}
            data={variantOptions}
            {...form.getInputProps('screeningLocalModelVariant')}
          />
        ) : null}

        {form.values.screeningLocalEnabled ? (
          <LocalParallelismControl
            gpu={gpu}
            variant={form.values.screeningLocalModelVariant}
            value={form.values.screeningLocalParallelism}
            onChange={(v) =>
              form.setFieldValue('screeningLocalParallelism', v)
            }
          />
        ) : null}

        <ScreeningStatsPanel />

        <Group justify="flex-end">
          <Button type="submit" loading={isPending}>
            Save settings
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function LocalParallelismControl({
  gpu,
  variant,
  value,
  onChange,
}: {
  gpu: IGpuCheckResult | null;
  variant: ELocalModelVariant;
  value: string;
  onChange: (v: string) => void;
}) {
  const suggested = suggestParallelism(gpu, variant);
  const helperBits: string[] = [
    `Each worker loads its own copy of the model into GPU memory; more workers = more parallel verdicts, more memory used.`,
  ];
  if (gpu?.status === 'capable_high' || gpu?.status === 'capable_low') {
    helperBits.push(
      `Detected: ${gpu.vendor ?? 'WebGPU adapter'}${gpu.maxBufferMB ? ` (~${gpu.maxBufferMB}MB max buffer)` : ''}. Suggested: ${suggested}.`,
    );
  } else if (gpu?.status === 'unsupported_browser' || gpu?.status === 'no_adapter') {
    helperBits.push(
      `WebGPU not available in this browser, so the local screen will not run regardless of this setting.`,
    );
  } else {
    helperBits.push('Probing your GPU...');
  }
  helperBits.push(
    `Larger downloads happen once and are cached, so bandwidth is a one-time cost; consider 1 worker if you are on metered/slow internet and have not loaded the model yet.`,
  );
  return (
    <div>
      <Text size="sm" fw={500} mb={4}>
        Parallel local screen workers
      </Text>
      <Text size="xs" c="dimmed" mb="xs">
        {helperBits.join(' ')}
      </Text>
      <Group gap="xs" wrap="wrap" align="center">
        {(['1', '2', '3', '4'] as const).map((n) => (
          <Button
            key={n}
            size="xs"
            variant={value === n ? 'filled' : 'default'}
            onClick={() => onChange(n)}
          >
            {n}
            {String(suggested) === n ? (
              <Text component="span" size="xs" ml={4}>
                *
              </Text>
            ) : null}
          </Button>
        ))}
      </Group>
    </div>
  );
}

function describeGpuRecommendation(gpu: IGpuCheckResult | null): string {
  if (gpu === null) {
    return 'Checking your GPU to recommend a size...';
  }
  if (gpu.status === 'capable_high') {
    return `Your GPU looks capable${gpu.maxBufferMB ? ` (${gpu.maxBufferMB}MB max buffer)` : ''}, so Stronger is recommended.`;
  }
  if (gpu.status === 'capable_low') {
    return `Your GPU has limited buffer capacity${gpu.maxBufferMB ? ` (~${gpu.maxBufferMB}MB)` : ''}, so Smaller is recommended; Stronger may fail to load.`;
  }
  return 'WebGPU is not available in this browser, so the local screen will not run regardless of the size picked. Defaulting to Stronger.';
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
