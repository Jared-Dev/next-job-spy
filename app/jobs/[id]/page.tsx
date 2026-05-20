'use client';

import {
  Anchor,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconBuildingSkyscraper,
  IconExternalLink,
  IconEyeOff,
  IconMail,
  IconMapPin,
  IconStar,
} from '@tabler/icons-react';
import Link from 'next/link';
import { use, useTransition } from 'react';

import { TailorPanel } from '@/components/generate/TailorPanel';
import { FitScoreRing } from '@/components/jobs/FitScoreRing';
import { PageHeader } from '@/components/ui/PageHeader';
import { adapter } from '@/lib/storage';
import { EJobStatus } from '@/lib/storage/types/EJobStatus';

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const jobId = Number(id);
  const job = adapter.useJob(jobId);
  const [pending, startTransition] = useTransition();

  function setStatus(status: EJobStatus) {
    startTransition(async () => {
      await adapter.updateJobStatus(jobId, status);
    });
  }

  if (job === undefined) {
    return (
      <Container size="lg" px={0}>
        <Skeleton height={48} mb="md" />
        <Skeleton height={200} />
      </Container>
    );
  }

  return (
    <Container size="lg" px={0}>
      <Group justify="space-between" align="center" mb="md">
        <Anchor component={Link} href="/jobs" size="sm">
          <Group gap={4} wrap="nowrap">
            <IconArrowLeft size={14} stroke={1.6} />
            All jobs
          </Group>
        </Anchor>
      </Group>

      <PageHeader title={job.title} />

      <Paper p="lg" withBorder mb="lg">
        <Group justify="space-between" wrap="nowrap" align="flex-start" gap="lg">
          <Group gap="md" align="flex-start" wrap="nowrap">
            <FitScoreRing score={job.fitScore} size={68} />
            <Stack gap={4}>
              <Group gap={6} c="dimmed">
                <IconBuildingSkyscraper size={14} stroke={1.6} />
                <Text>{job.company}</Text>
                {job.location ? (
                  <>
                    <Text>·</Text>
                    <IconMapPin size={14} stroke={1.6} />
                    <Text>{job.location}</Text>
                  </>
                ) : null}
              </Group>
              <Group gap={6}>
                <Badge variant="light" color="gray" size="sm">
                  {job.source}
                </Badge>
                {job.remote ? (
                  <Badge variant="light" color="teal" size="sm">
                    Remote
                  </Badge>
                ) : null}
                {job.status === EJobStatus.Saved ? (
                  <Badge variant="light" color="indigo" size="sm">
                    Saved
                  </Badge>
                ) : null}
                {job.status === EJobStatus.Applied ? (
                  <Badge variant="light" color="violet" size="sm">
                    Applied
                  </Badge>
                ) : null}
              </Group>
              {job.fitNotes ? (
                <Text size="sm" c="dimmed" mt="xs" maw={520}>
                  {job.fitNotes}
                </Text>
              ) : null}
            </Stack>
          </Group>

          <Stack gap="xs" align="flex-end">
            <Button
              component="a"
              href={job.url}
              target="_blank"
              rel="noreferrer"
              variant="default"
              leftSection={<IconExternalLink size={16} stroke={1.6} />}
            >
              Open posting
            </Button>
            <Group gap="xs" wrap="nowrap">
              <Button
                variant={job.status === EJobStatus.Saved ? 'filled' : 'default'}
                color="indigo"
                size="xs"
                leftSection={<IconStar size={14} stroke={1.6} />}
                onClick={() =>
                  setStatus(
                    job.status === EJobStatus.Saved ? EJobStatus.New : EJobStatus.Saved,
                  )
                }
                disabled={pending}
              >
                {job.status === EJobStatus.Saved ? 'Saved' : 'Save'}
              </Button>
              <Button
                variant={job.status === EJobStatus.Applied ? 'filled' : 'default'}
                color="violet"
                size="xs"
                leftSection={<IconMail size={14} stroke={1.6} />}
                onClick={() =>
                  setStatus(
                    job.status === EJobStatus.Applied
                      ? EJobStatus.Saved
                      : EJobStatus.Applied,
                  )
                }
                disabled={pending}
              >
                {job.status === EJobStatus.Applied ? 'Applied' : 'Mark applied'}
              </Button>
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                leftSection={<IconEyeOff size={14} stroke={1.6} />}
                onClick={() => setStatus(EJobStatus.Hidden)}
                disabled={pending}
              >
                Hide
              </Button>
            </Group>
          </Stack>
        </Group>
      </Paper>

      <Box mb="lg">
        <TailorPanel job={job} />
      </Box>

      <Paper p="lg" withBorder>
        <Title order={4} fw={600} mb="sm">
          Description
        </Title>
        <Divider mb="md" />
        {job.descriptionMd ? (
          <Box
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: 'var(--mantine-font-size-sm)',
              lineHeight: 1.55,
            }}
          >
            {job.descriptionMd}
          </Box>
        ) : (
          <Text c="dimmed">No description text was returned by the source.</Text>
        )}
      </Paper>
    </Container>
  );
}
