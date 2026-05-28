'use client';

import {
  Button,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Typography,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconDownload,
  IconExclamationCircle,
  IconPlus,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { postJson } from '@/lib/ai/postJson';
import {
  PENDING_IMPORT_STORAGE_KEY,
  type IPendingImport,
} from '@/lib/jobs/importJob/pendingImport';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import { inferCountry } from '@/lib/jobs/inferCountry';
import type { IImportedJob } from '@/lib/jobs/importJob/types/IImportedJob';
import { isProfileMeaningful } from '@/lib/profile/isProfileMeaningful';
import { markdownToHtml } from '@/lib/resume/markdownToHtml';
import { adapter } from '@/lib/storage';
import { EJobStatus } from '@/lib/storage/types/EJobStatus';
import { ESourceId } from '@/lib/storage/types/ESourceId';
import type { IJob } from '@/lib/storage/types/IJob';

import type { TAddJobFormValues } from './types/TAddJobFormValues';

/** Current time as whole unix seconds, matches the job table's discoveredAt. */
function unixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

interface IImportResponse {
  fields: IImportedJob;
  via: 'structured' | 'ai' | 'partial' | 'none';
  note?: string;
}

interface IRankResultRow {
  id: string;
  fitScore: number;
  fitNotes: string;
}
interface IRankResponse {
  results: IRankResultRow[];
}

const RANK_DESCRIPTION_CAP = 4000;

export function AddJobButton() {
  const [opened, { open, close }] = useDisclosure(false);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const router = useRouter();
  const settings = adapter.useSettings();
  const profile = adapter.useProfile();

  const form = useForm<TAddJobFormValues>({
    initialValues: {
      title: '',
      company: '',
      location: '',
      url: '',
      remote: false,
      description: '',
    },
    validate: {
      title: (v) => (v.trim() ? null : 'Job title is required'),
      company: (v) => (v.trim() ? null : 'Company is required'),
      description: (v) =>
        v.trim().length < 40
          ? 'Paste the job description so the tailoring engine has something to work with'
          : null,
    },
  });

  // The bookmarklet handoff (popup at /clip) extracts the posting,
  // stashes the merged fields in sessionStorage, then redirects here.
  // On mount we hydrate the form and pop the modal so the user lands
  // on a populated review screen instead of an empty form. We clear
  // the storage immediately so a refresh doesn't re-trigger this.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem(PENDING_IMPORT_STORAGE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PENDING_IMPORT_STORAGE_KEY);
    try {
      const pending = JSON.parse(raw) as IPendingImport;
      const f = pending.fields ?? {};
      form.setValues({
        title: f.title ?? '',
        company: f.company ?? '',
        location: f.location ?? '',
        url: pending.url ?? '',
        remote: f.remote ?? false,
        description: f.descriptionMd ?? '',
      });
      if (f.descriptionMd) {
        // Matches the pattern at /jobs page.tsx for browser-only state
        // synced via useEffect: setState-in-effect is the only way to
        // hydrate from sessionStorage post-mount without an SSR mismatch.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowPreview(true);
      }
      open();
      const missing: string[] = [];
      if (!f.title) missing.push('title');
      if (!f.company) missing.push('company');
      if (!f.descriptionMd) missing.push('description');
      notifications.show({
        color: missing.length > 0 ? 'yellow' : 'teal',
        icon:
          missing.length > 0 ? (
            <IconExclamationCircle size={18} />
          ) : (
            <IconCheck size={18} />
          ),
        title:
          missing.length > 0
            ? `Imported, ${missing.join(' / ')} needs review`
            : 'Imported from the page',
        message:
          missing.length > 0
            ? 'Fill the blank fields, tweak anything wrong, then save.'
            : 'Review the fields, then save the job.',
      });
    } catch {
      // Stash was malformed; the modal stays closed and the form
      // empty. No noisy alert; the user can hit Add job manually.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleImport() {
    const url = form.values.url.trim();
    if (!url) return;
    setImporting(true);
    try {
      const data = await postJson<IImportResponse>('/api/import-job', {
        url,
        useAi: settings?.aiImportFallback !== false,
      });
      const f = data.fields;
      form.setValues({
        ...form.values,
        title: f.title ?? form.values.title,
        company: f.company ?? form.values.company,
        location: f.location ?? form.values.location,
        remote: f.remote ?? form.values.remote,
        description: f.descriptionMd ?? form.values.description,
      });
      if (f.descriptionMd) setShowPreview(true);
      if (data.via === 'none') {
        notifications.show({
          color: 'yellow',
          icon: <IconExclamationCircle size={18} />,
          title: 'Nothing to import',
          message:
            "Couldn't read job details from that page,fill the form in by hand.",
        });
      } else {
        const imported = data.via === 'ai' || data.via === 'structured';
        notifications.show({
          color: 'teal',
          icon: <IconCheck size={18} />,
          title:
            data.via === 'ai'
              ? 'Imported with AI assist'
              : data.via === 'structured'
                ? 'Imported from the posting'
                : 'Imported what we could',
          message: imported
            ? 'Review the filled fields, then add the job.'
            : 'Some fields may be blank,review and complete them.',
        });
      }
    } catch (err) {
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Import failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setImporting(false);
    }
  }

  async function handleSubmit(values: TAddJobFormValues) {
    setBusy(true);
    try {
      const now = unixSeconds();
      const location = values.location.trim();
      const description = values.description.trim();
      const job: IJob = {
        source: ESourceId.Manual,
        sourceId: crypto.randomUUID(),
        url: values.url.trim(),
        title: values.title.trim(),
        company: values.company.trim(),
        location: location || undefined,
        country: inferCountry(location),
        remote: values.remote,
        descriptionMd: description,
        discoveredAt: now,
        status: EJobStatus.Saved,
      };
      const id = await adapter.createJob(job);
      form.reset();
      setShowPreview(false);
      close();
      router.push(`/jobs/${id}`);
      notifications.show({
        color: 'teal',
        title: 'Job added',
        message: `${job.title} at ${job.company}. Scoring now…`,
      });

      // Manual jobs skip the screening cascade and go straight to Claude
      // scoring. Fire-and-forget so the redirect happens immediately; the
      // job detail page picks up the score reactively once it lands.
      if (isProfileMeaningful(profile)) {
        const truncated =
          description.length > RANK_DESCRIPTION_CAP
            ? `${description.slice(0, RANK_DESCRIPTION_CAP)}\n\n[Description truncated by client at ${RANK_DESCRIPTION_CAP} chars; score what is shown.]`
            : description;
        void postJson<IRankResponse>('/api/ai/rank', {
          profile,
          jobs: [
            {
              id: String(id),
              title: job.title,
              company: job.company,
              location: job.location,
              description: truncated,
            },
          ],
          model: EAnthropicModel.Haiku45,
        })
          .then(async (res) => {
            const result = res.results[0];
            if (!result) return;
            await adapter.updateJobFit(id, result.fitScore, result.fitNotes);
          })
          .catch((err: unknown) => {
            notifications.show({
              color: 'yellow',
              icon: <IconExclamationCircle size={18} />,
              title: 'Could not score yet',
              message:
                err instanceof Error
                  ? err.message
                  : 'The job was added; scoring will retry from the list.',
            });
          });
      }
    } catch (err) {
      notifications.show({
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Could not add job',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button leftSection={<IconPlus size={16} stroke={1.6} />} onClick={open}>
        Add job
      </Button>
      <Modal opened={opened} onClose={close} title="Add a job by hand" size="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Paste a posting URL and hit Try import to auto-fill, or enter
              everything by hand. A saved job can be ranked and tailored just
              like a sourced one. For sites that block our fetch (LinkedIn,
              Indeed, Glassdoor), grab the one-click bookmarklet from{' '}
              <a href="/settings">Settings</a>.
            </Text>

            <Group align="flex-end" wrap="nowrap" gap="xs">
              <TextInput
                label="Posting URL"
                placeholder="https://www.linkedin.com/jobs/view/…"
                description="LinkedIn, a company careers page, anywhere."
                style={{ flex: 1 }}
                {...form.getInputProps('url')}
              />
              <Button
                variant="default"
                leftSection={<IconDownload size={16} stroke={1.6} />}
                onClick={handleImport}
                loading={importing}
                disabled={!form.values.url.trim() || busy}
              >
                Try import
              </Button>
            </Group>

            <Group grow align="flex-start">
              <TextInput
                label="Job title"
                placeholder="Staff Frontend Engineer"
                withAsterisk
                {...form.getInputProps('title')}
              />
              <TextInput
                label="Company"
                placeholder="Acme Inc."
                withAsterisk
                {...form.getInputProps('company')}
              />
            </Group>

            <TextInput
              label="Location"
              placeholder="San Francisco, CA"
              description="Used to infer the country for filtering."
              {...form.getInputProps('location')}
            />

            <Switch
              label="Remote role"
              {...form.getInputProps('remote', { type: 'checkbox' })}
            />

            <Stack gap={6}>
              <Group justify="space-between" align="center">
                <Text size="sm" fw={500}>
                  Job description{' '}
                  <Text span c="red">
                    *
                  </Text>
                </Text>
                <SegmentedControl
                  size="xs"
                  value={showPreview ? 'preview' : 'write'}
                  onChange={(v) => setShowPreview(v === 'preview')}
                  data={[
                    { value: 'write', label: 'Write' },
                    { value: 'preview', label: 'Preview' },
                  ]}
                />
              </Group>
              {showPreview ? (
                <Paper
                  withBorder
                  p="md"
                  style={{ minHeight: 200, maxHeight: 420, overflowY: 'auto' }}
                >
                  {form.values.description.trim() ? (
                    <Typography>
                      <div
                        dangerouslySetInnerHTML={{
                          __html: markdownToHtml(form.values.description),
                        }}
                      />
                    </Typography>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Nothing to preview yet,paste or import a description.
                    </Text>
                  )}
                </Paper>
              ) : (
                <Textarea
                  placeholder="Paste the full job description here…"
                  autosize
                  minRows={8}
                  maxRows={18}
                  {...form.getInputProps('description')}
                  error={undefined}
                />
              )}
              <Text size="xs" c="dimmed">
                The more you paste, the better the tailoring. Markdown renders
                in Preview.
              </Text>
              {form.errors.description ? (
                <Text size="xs" c="red">
                  {form.errors.description}
                </Text>
              ) : null}
            </Stack>

            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={close} disabled={busy || importing}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={importing}>
                Add job
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
