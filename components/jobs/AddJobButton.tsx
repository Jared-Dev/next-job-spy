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
import { useState } from 'react';

import { postJson } from '@/lib/ai/postJson';
import { inferCountry } from '@/lib/jobs/inferCountry';
import type { IImportedJob } from '@/lib/jobs/importJob/types/IImportedJob';
import { markdownToHtml } from '@/lib/resume/markdownToHtml';
import { adapter } from '@/lib/storage';
import { EJobStatus } from '@/lib/storage/types/EJobStatus';
import { ESourceId } from '@/lib/storage/types/ESourceId';
import type { IJob } from '@/lib/storage/types/IJob';

import type { TAddJobFormValues } from './types/TAddJobFormValues';

/** Current time as whole unix seconds — matches the job table's discoveredAt. */
function unixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

interface IImportResponse {
  fields: IImportedJob;
  via: 'structured' | 'ai' | 'partial' | 'none';
  note?: string;
}

export function AddJobButton() {
  const [opened, { open, close }] = useDisclosure(false);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const router = useRouter();
  const settings = adapter.useSettings();

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
            "Couldn't read job details from that page — fill the form in by hand.",
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
            : 'Some fields may be blank — review and complete them.',
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
      const job: IJob = {
        source: ESourceId.Manual,
        sourceId: crypto.randomUUID(),
        url: values.url.trim(),
        title: values.title.trim(),
        company: values.company.trim(),
        location: location || undefined,
        country: inferCountry(location),
        remote: values.remote,
        descriptionMd: values.description.trim(),
        discoveredAt: now,
        status: EJobStatus.Saved,
      };
      const id = await adapter.createJob(job);
      notifications.show({
        color: 'teal',
        title: 'Job added',
        message: `${job.title} at ${job.company} — rank it or tailor a resume now.`,
      });
      form.reset();
      setShowPreview(false);
      close();
      router.push(`/jobs/${id}`);
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
              Paste a posting URL and hit Try import to auto-fill — or enter
              everything by hand. A saved job can be ranked and tailored just
              like a sourced one.
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
                      Nothing to preview yet — paste or import a description.
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
