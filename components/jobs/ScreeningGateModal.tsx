'use client';

import {
  Alert,
  Anchor,
  Button,
  Modal,
  Paper,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCloud, IconCpu, IconExclamationCircle, IconFilter } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import {
  checkWebGpuCapability,
  type IGpuCheckResult,
} from '@/lib/screening/local/gpuCheck';
import { adapter } from '@/lib/storage';
import { ELocalModelVariant } from '@/lib/storage/types/ELocalModelVariant';

interface IScreeningGateModalProps {
  opened: boolean;
  onSaved: () => void;
}

/**
 * First-visit gate. The user has to make a deliberate choice about each
 * cascade stage before /jobs proceeds. There is no silent default. Both
 * toggles start at the recommended config (on) so a "yes that's fine"
 * user has a one-click path; the act of clicking Save records the choice.
 */
export function ScreeningGateModal({ opened, onSaved }: IScreeningGateModalProps) {
  const [embedding, setEmbedding] = useState(true);
  const [local, setLocal] = useState(true);
  const [variant, setVariant] = useState<ELocalModelVariant>(ELocalModelVariant.Stronger);
  const [variantTouched, setVariantTouched] = useState(false);
  const [gpu, setGpu] = useState<IGpuCheckResult | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    void checkWebGpuCapability().then((result) => {
      setGpu(result);
      // Auto-recommend Smaller if the adapter looks underpowered, but
      // only when the user has not already touched the control. The
      // user's explicit choice always wins.
      if (!variantTouched && result.status === 'capable_low') {
        setVariant(ELocalModelVariant.Smaller);
      }
    });
  }, [opened, variantTouched]);

  function changeVariant(v: ELocalModelVariant) {
    setVariantTouched(true);
    setVariant(v);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await adapter.saveSettings({
        screeningEmbeddingEnabled: embedding,
        screeningLocalEnabled: local,
        screeningLocalModelVariant: variant,
      });
      onSaved();
    } catch (err) {
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Could not save',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={() => {
        // Cannot dismiss without saving. The gate enforces a deliberate choice.
      }}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      size="lg"
      centered
      title={<Title order={4}>How should we screen jobs?</Title>}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Before Claude scores a job, we can run cheaper filters to skip
          obvious mismatches. Each stage is optional. Pick what you want
          running. You can change this any time in Settings.
        </Text>

        <Paper p="md" withBorder>
          <Switch
            checked={embedding}
            onChange={(e) => setEmbedding(e.currentTarget.checked)}
            size="md"
            label={
              <Text fw={600} size="sm">
                <ThemeIcon
                  variant="light"
                  color="teal"
                  size="sm"
                  style={{ verticalAlign: 'middle', marginRight: 6 }}
                >
                  <IconFilter size={14} />
                </ThemeIcon>
                Embedding pre-filter
                <Text component="span" size="xs" c="dimmed" ml={6}>
                  recommended
                </Text>
              </Text>
            }
            description="Topical similarity vs your profile. Catches wrong-field mismatches (e.g. a nursing job when you're a developer) in milliseconds. ~33MB model, zero cost, runs server-side at ingest."
          />
        </Paper>

        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Switch
              checked={local}
              onChange={(e) => setLocal(e.currentTarget.checked)}
              size="md"
              label={
                <Text fw={600} size="sm">
                  <ThemeIcon
                    variant="light"
                    color="indigo"
                    size="sm"
                    style={{ verticalAlign: 'middle', marginRight: 6 }}
                  >
                    <IconCpu size={14} />
                  </ThemeIcon>
                  Local LLM screen
                </Text>
              }
              description="Reasoning-based filter that runs in your browser tab while you work. Catches misfits embeddings miss: clearance, on-site mandates, seniority. Runs on your GPU; private, no API cost."
            />

            {local ? (
              <Stack gap="xs" pl="xl">
                <Text size="xs" fw={500} c="dimmed">
                  Model size
                </Text>
                <SegmentedControl
                  fullWidth
                  size="sm"
                  value={variant}
                  onChange={(v) => changeVariant(v as ELocalModelVariant)}
                  data={[
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
                  ]}
                />
                <GpuRecommendationNote gpu={gpu} />
              </Stack>
            ) : null}
          </Stack>
        </Paper>

        <Alert icon={<IconCloud size={18} />} color="gray" variant="light">
          <Text size="sm">
            Whichever stages you pick, surviving jobs are scored by Claude only
            when you actually look at them. View-driven, with prompt caching
            keeping the per-job cost minimal.
          </Text>
        </Alert>

        <Text size="xs" c="dimmed">
          Change these any time in{' '}
          <Anchor href="/settings" size="xs">
            Settings
          </Anchor>
          .
        </Text>

        <Button onClick={handleSave} loading={saving} fullWidth size="md">
          Save and continue
        </Button>
      </Stack>
    </Modal>
  );
}

/**
 * Helper text under the variant chooser. Reflects what the WebGPU
 * probe found so the user can see we are not just throwing a default
 * at them.
 */
function GpuRecommendationNote({ gpu }: { gpu: IGpuCheckResult | null }) {
  if (gpu === null) {
    return (
      <Text size="xs" c="dimmed">
        Checking your GPU to recommend a size...
      </Text>
    );
  }
  if (gpu.status === 'capable_high') {
    return (
      <Text size="xs" c="dimmed">
        Your GPU looks capable
        {gpu.maxBufferMB ? ` (${gpu.maxBufferMB}MB max buffer)` : ''}, so
        Stronger is recommended. Smaller still works if you would rather a
        lighter download.
      </Text>
    );
  }
  if (gpu.status === 'capable_low') {
    return (
      <Text size="xs" c="dimmed">
        Your GPU has limited buffer capacity
        {gpu.maxBufferMB ? ` (~${gpu.maxBufferMB}MB)` : ''}, so Smaller is
        recommended; Stronger may fail to load.
      </Text>
    );
  }
  // unsupported_browser / no_adapter: WebGPU not available. Choosing here
  // is moot because the local stage will not run; we still surface this
  // so the user understands why the variant choice does not matter.
  return (
    <Text size="xs" c="dimmed">
      WebGPU is not available in this browser, so the local screen will not
      run regardless of the size picked. The embedding screen still works
      on the server. Defaulting to Stronger in case you enable on a
      different device.
    </Text>
  );
}
