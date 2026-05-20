'use client';

import {
  Button,
  Group,
  Modal,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconExclamationCircle, IconPlus } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { inferCountry } from '@/lib/jobs/inferCountry';
import { adapter } from '@/lib/storage';
import { EJobStatus } from '@/lib/storage/types/EJobStatus';
import { ESourceId } from '@/lib/storage/types/ESourceId';
import type { IJob } from '@/lib/storage/types/IJob';

import type { TAddJobFormValues } from './types/TAddJobFormValues';

/** Current time as whole unix seconds — matches the job table's discoveredAt. */
function unixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function AddJobButton() {
  const [opened, { open, close }] = useDisclosure(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

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
              Paste a posting from LinkedIn or anywhere else. Once it&apos;s in, it
              behaves like any sourced job — rank it, and generate a tailored
              resume against it.
            </Text>

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

            <Group grow align="flex-start">
              <TextInput
                label="Location"
                placeholder="San Francisco, CA"
                description="Used to infer the country for filtering."
                {...form.getInputProps('location')}
              />
              <TextInput
                label="Posting URL"
                placeholder="https://www.linkedin.com/jobs/view/…"
                description="Optional — a link back to the original posting."
                {...form.getInputProps('url')}
              />
            </Group>

            <Switch
              label="Remote role"
              {...form.getInputProps('remote', { type: 'checkbox' })}
            />

            <Textarea
              label="Job description"
              placeholder="Paste the full job description here…"
              description="The more you paste, the better the tailoring. Formatting doesn't matter."
              withAsterisk
              autosize
              minRows={8}
              maxRows={18}
              {...form.getInputProps('description')}
            />

            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Add job
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
