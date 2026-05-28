'use client';

import {
  Button,
  Container,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconBriefcase,
  IconCheckupList,
  IconMailForward,
  IconSearch,
  IconSparkles,
  IconUser,
} from '@tabler/icons-react';
import Link from 'next/link';

import { ApplicationsPanel } from '@/components/applications/ApplicationsPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { adapter } from '@/lib/storage';
import { EApplicationStatus } from '@/lib/storage/types/EApplicationStatus';

export default function HomePage() {
  const profile = adapter.useProfile();
  const applications = adapter.useApplications();

  const appliedCount = applications ? String(applications.length) : '-';
  const interviewingCount = applications
    ? String(
        applications.filter((a) => a.status === EApplicationStatus.Interview)
          .length,
      )
    : '-';

  const hasProfile =
    profile !== undefined &&
    (Boolean(profile.fullName) ||
      (profile.workHistory?.length ?? 0) > 0 ||
      (profile.skills?.length ?? 0) > 0);

  return (
    <Container size="lg" px={0}>
      <PageHeader title="Dashboard" description="Your local AI-powered job-search co-pilot." />

      {!hasProfile ? (
        <EmptyState
          icon={IconUser}
          title="Start with your profile"
          description="Fill in your career history, skills, and achievements once. Per-job ATS-optimized resumes get generated from this canonical source."
          primaryAction={{ href: '/profile', label: 'Build profile' }}
        />
      ) : (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <StatCard icon={IconBriefcase} label="Discovered" value="-" hint="Jobs in Phase 2" />
            <StatCard icon={IconCheckupList} label="Saved" value="-" hint="Coming next" />
            <StatCard
              icon={IconMailForward}
              label="Applied"
              value={appliedCount}
              hint="Jobs applied to"
            />
            <StatCard
              icon={IconSparkles}
              label="Interviewing"
              value={interviewingCount}
              hint="In the interview stage"
            />
          </SimpleGrid>

          <Grid gap="md">
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Paper p="lg" withBorder>
                <Group justify="space-between" align="flex-start" mb="sm">
                  <Group gap="sm">
                    <IconUser size={20} stroke={1.6} color="var(--mantine-color-indigo-5)" />
                    <Title order={4} fw={600}>
                      Profile snapshot
                    </Title>
                  </Group>
                  <Button component={Link} href="/profile" size="xs" variant="light">
                    Edit
                  </Button>
                </Group>
                <Stack gap={4}>
                  {profile?.fullName ? (
                    <Text fw={500}>{profile.fullName}</Text>
                  ) : (
                    <Text c="dimmed">No name yet</Text>
                  )}
                  {profile?.headline ? (
                    <Text size="sm" c="dimmed">
                      {profile.headline}
                    </Text>
                  ) : null}
                </Stack>
                <SimpleGrid cols={3} spacing="sm" mt="md">
                  <MiniStat label="Roles" value={profile?.workHistory?.length ?? 0} />
                  <MiniStat label="Skills" value={profile?.skills?.length ?? 0} />
                  <MiniStat label="Education" value={profile?.education?.length ?? 0} />
                </SimpleGrid>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 5 }}>
              <Paper p="lg" withBorder>
                <Group gap="sm" mb="xs">
                  <IconSearch size={20} stroke={1.6} color="var(--mantine-color-indigo-5)" />
                  <Title order={4} fw={600}>
                    Job sources
                  </Title>
                </Group>
                <Text size="sm" c="dimmed" mb="md">
                  Ingest from Greenhouse, Lever, RemoteOK, and We Work Remotely. Rank against your profile, then tailor a resume per match.
                </Text>
                <Button component={Link} href="/sources" variant="light">
                  Manage sources
                </Button>
              </Paper>
            </Grid.Col>
          </Grid>

          <Paper p="lg" withBorder>
            <Group justify="space-between" align="center" mb="sm">
              <Group gap="sm">
                <IconMailForward
                  size={20}
                  stroke={1.6}
                  color="var(--mantine-color-indigo-5)"
                />
                <Title order={4} fw={600}>
                  Applications
                </Title>
              </Group>
              <Button component={Link} href="/applications" size="xs" variant="light">
                View all
              </Button>
            </Group>
            <ApplicationsPanel limit={5} />
          </Paper>
        </Stack>
      )}
    </Container>
  );
}

interface IStatCardProps {
  icon: typeof IconUser;
  label: string;
  value: string;
  hint?: string;
}

function StatCard({ icon: Icon, label, value, hint }: IStatCardProps) {
  return (
    <Paper p="md" withBorder>
      <Stack gap={4}>
        <Group gap="xs" c="dimmed">
          <Icon size={16} stroke={1.6} />
          <Text size="xs" tt="uppercase" fw={600}>
            {label}
          </Text>
        </Group>
        <Text size="xl" fw={700} lh={1.1}>
          {value}
        </Text>
        {hint ? (
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="lg" fw={600}>
        {value}
      </Text>
    </Stack>
  );
}
