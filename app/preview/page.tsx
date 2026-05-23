'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Group,
  NumberInput,
  Paper,
  Progress,
  RingProgress,
  SimpleGrid,
  Select,
  Stack,
  Switch,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
  rem,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconAlertTriangle,
  IconBriefcase,
  IconBuildingSkyscraper,
  IconCheck,
  IconCircleDashed,
  IconCopy,
  IconExternalLink,
  IconEye,
  IconMail,
  IconMapPin,
  IconPrinter,
  IconRefresh,
  IconSparkles,
  IconUser,
  IconWand,
} from '@tabler/icons-react';
import { useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';

export default function PreviewPage() {
  return (
    <Container size="lg" px={0}>
      <PageHeader
        title="Visual preview"
        description="Every UI element a user will encounter. Mock data only — nothing here is wired up. Delete this route once the design is approved."
      />

      <Stack gap="xl">
        <Section
          title="Typography & color"
          description="One sans family (Geist), two weights (400/600), indigo accent. Hierarchy through size and weight only."
        >
          <Stack gap="md">
            <Title order={1}>Page title — 32px / 600</Title>
            <Title order={2}>Section title — 24px / 600</Title>
            <Title order={3}>Subsection — 20px / 600</Title>
            <Title order={4}>Card title — 16px / 600</Title>
            <Text>Body text — 16px / 400. The default voice of the interface.</Text>
            <Text size="sm" c="dimmed">
              Hint / description text — 14px / 400 dimmed. Used everywhere a label needs context.
            </Text>
            <Group gap="xs">
              <Badge color="indigo" variant="filled">
                Primary accent
              </Badge>
              <Badge color="indigo" variant="light">
                Light accent
              </Badge>
              <Badge color="gray" variant="light">
                Neutral
              </Badge>
              <Badge color="teal" variant="light">
                Success
              </Badge>
              <Badge color="yellow" variant="light">
                Warning
              </Badge>
              <Badge color="red" variant="light">
                Error
              </Badge>
            </Group>
          </Stack>
        </Section>

        <Section
          title="Buttons & cost transparency"
          description="Anything that spends tokens shows estimated cost. Session total lives in the header."
        >
          <Stack gap="md">
            <Group gap="sm">
              <Button>Primary</Button>
              <Button variant="light">Light</Button>
              <Button variant="default">Default</Button>
              <Button variant="subtle">Subtle</Button>
              <Button color="red" variant="light">
                Destructive
              </Button>
              <Button disabled>Disabled</Button>
            </Group>

            <Divider
              label="AI buttons show token estimates only — never dollars pre-call"
              labelPosition="left"
            />

            <Group gap="sm">
              <CostButton
                icon={<IconWand size={16} stroke={1.6} />}
                label="Rank 12 new jobs"
                tokens="~6K in · ≤0.5K out"
              />
              <CostButton
                icon={<IconSparkles size={16} stroke={1.6} />}
                label="Tailor resume"
                tokens="~4K in · ≤2.5K out"
                variant="filled"
              />
              <CostButton
                icon={<IconMail size={16} stroke={1.6} />}
                label="Cover letter"
                tokens="~4K in · ≤0.8K out"
              />
            </Group>

            <Divider
              label="Session total — actuals only, computed from response usage"
              labelPosition="left"
            />

            <Group>
              <Paper
                px="sm"
                py={6}
                withBorder
                radius="xl"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Text size="sm" fw={500} ff="monospace">
                  12.4K
                </Text>
                <Text size="xs" c="dimmed">in</Text>
                <Text size="xs" c="dimmed">·</Text>
                <Text size="sm" fw={500} ff="monospace">
                  4.2K
                </Text>
                <Text size="xs" c="dimmed">out · 3 calls</Text>
              </Paper>
              <Paper
                px="sm"
                py={6}
                withBorder
                radius="xl"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Text size="xs" c="dimmed">
                  no calls yet
                </Text>
              </Paper>
            </Group>

            <Divider label="Artifact stamp — actual cost from completed call" labelPosition="left" />

            <Paper p="md" withBorder>
              <Group justify="space-between" wrap="nowrap" align="center">
                <Stack gap={2}>
                  <Group gap="xs">
                    <Text fw={500} size="sm">
                      Tailored resume · ic-technical
                    </Text>
                    <Badge size="xs" variant="light" color="gray">
                      v3
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Senior Frontend Engineer at Anthropic · 2 min ago
                  </Text>
                </Stack>
                <Group gap="md">
                  <Stack gap={0} align="flex-end">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600} lh={1}>
                      Actual cost
                    </Text>
                    <Text size="sm" fw={500} ff="monospace">
                      $0.0182
                    </Text>
                  </Stack>
                  <Stack gap={0} align="flex-end">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600} lh={1}>
                      Tokens
                    </Text>
                    <Text size="xs" ff="monospace" c="dimmed">
                      3.8K → 2.1K
                    </Text>
                  </Stack>
                </Group>
              </Group>
            </Paper>
          </Stack>
        </Section>

        <Section
          title="Stat cards (dashboard)"
          description="Compact summaries with subtle icons and hint text. No big numbers without context."
        >
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <StatCard icon={IconBriefcase} label="Discovered" value="48" hint="Across 4 sources" />
            <StatCard icon={IconEye} label="Saved" value="9" hint="Pending review" />
            <StatCard icon={IconMail} label="Applied" value="3" hint="Last 14 days" />
            <StatCard icon={IconSparkles} label="Interviewing" value="1" hint="Anthropic · Round 2" />
          </SimpleGrid>
        </Section>

        <Section
          title="Empty state"
          description="What new users see before they've done anything."
        >
          <EmptyState
            icon={IconUser}
            title="Start with your profile"
            description="Fill in your career history, skills, and achievements once. Per-job ATS-optimized resumes get generated from this canonical source."
            primaryAction={{ href: '#', label: 'Build profile' }}
            secondaryAction={{ href: '#', label: 'Add API key first' }}
          />
        </Section>

        <Section
          title="Forms"
          description="Mantine inputs grouped in a Paper card. Every field has a label and an optional description."
        >
          <Paper p="lg" withBorder>
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput label="Full name" defaultValue="Ada Lovelace" />
                <TextInput label="Headline" defaultValue="Staff Frontend Engineer" />
                <Select
                  label="Remote preference"
                  data={['Remote only', 'Hybrid OK', 'Onsite OK', 'Any']}
                  defaultValue="Hybrid OK"
                />
                <NumberInput label="Min salary" defaultValue={180000} prefix="$" thousandSeparator="," />
              </SimpleGrid>
              <Textarea
                label="Summary"
                description="A short paragraph in your voice. Used as the foundation for per-job tailoring."
                autosize
                minRows={3}
                defaultValue="Frontend engineer focused on design systems and developer experience. I like shipping the boring parts well so the interesting parts can land safely."
              />
              <TagsInput
                label="Skills"
                description="The vocabulary we draw from when tailoring."
                defaultValue={['React', 'TypeScript', 'Next.js', 'Design systems', 'Accessibility', 'Mantine', 'Radix']}
              />
              <Switch label="I'm open to relocating" defaultChecked />
              <Group justify="flex-end">
                <Button variant="default">Cancel</Button>
                <Button>Save profile</Button>
              </Group>
            </Stack>
          </Paper>
        </Section>

        <Section
          title="Job card (Phase 2)"
          description="Two density levels — list rows for /jobs, and a detail card for /jobs/[id]. Fit score is the visual focal point."
        >
          <Stack gap="md">
            {SAMPLE_JOBS.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </Stack>
        </Section>

        <Section
          title="Generation flow (Phase 3)"
          description="The per-job tailoring experience. Pick template, see estimated cost, stream output, open print view."
        >
          <Paper p="lg" withBorder>
            <Stack gap="md">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={4}>
                  <Title order={4} fw={600}>
                    Tailor resume for Senior Frontend Engineer at Anthropic
                  </Title>
                  <Text size="sm" c="dimmed">
                    Uses your profile + this JD + the selected template. Cached by content hash — regenerating identical inputs is free.
                  </Text>
                </Stack>
              </Group>

              <Group gap="sm" align="flex-end" wrap="wrap">
                <Select
                  label="Template"
                  description="Auto-picked from your profile shape; override anytime"
                  data={[
                    { value: 'ic-technical', label: 'IC technical (recommended)' },
                    { value: 'leader', label: 'Leader' },
                    { value: 'generalist', label: 'Generalist' },
                  ]}
                  defaultValue="ic-technical"
                  w={260}
                />
                <CostButton
                  icon={<IconSparkles size={16} stroke={1.6} />}
                  label="Generate"
                  tokens="~4K in · ≤2.5K out"
                  variant="filled"
                />
                <Button variant="default" leftSection={<IconRefresh size={16} stroke={1.6} />}>
                  Regenerate
                </Button>
              </Group>

              <Divider label="Streaming output (mock)" labelPosition="left" />

              <StreamingResumePreview />

              <Group justify="flex-end" gap="sm">
                <Button variant="default" leftSection={<IconCopy size={16} stroke={1.6} />}>
                  Copy markdown
                </Button>
                <Button leftSection={<IconPrinter size={16} stroke={1.6} />}>
                  Open print view
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Section>

        <Section
          title="Resume print preview (the headline)"
          description="A scaled-down render of /resume/[artifactId]/print using the ic-technical template's print CSS. Selectable text, ATS-safe, considered typography."
        >
          <Paper p="md" withBorder radius="md" bg="var(--mantine-color-gray-0)">
            <Box style={{ display: 'flex', justifyContent: 'center' }}>
              <ResumePrintMock />
            </Box>
          </Paper>
          <Text size="xs" c="dimmed" mt="xs" ta="center">
            Letter (8.5×11&quot;), 0.6&quot; margins, Geist 10.5pt / 1.4. Indigo accent on the candidate name and section labels.
          </Text>
        </Section>

        <Section
          title="Notifications & feedback"
          description="Use sparingly. Confirmations after actions, errors when something fails."
        >
          <Group gap="sm">
            <Button
              variant="light"
              color="teal"
              onClick={() =>
                notifications.show({
                  color: 'teal',
                  icon: <IconCheck size={18} />,
                  title: 'Profile saved',
                  message: "We'll use this to tailor resumes per job.",
                })
              }
            >
              Trigger success
            </Button>
            <Button
              variant="light"
              color="red"
              onClick={() =>
                notifications.show({
                  color: 'red',
                  icon: <IconAlertTriangle size={18} />,
                  title: 'Anthropic API error',
                  message: 'Rate limit hit. Wait 60s and try again — no tokens were consumed.',
                })
              }
            >
              Trigger error
            </Button>
            <Button
              variant="light"
              color="indigo"
              onClick={() =>
                notifications.show({
                  color: 'indigo',
                  icon: <IconSparkles size={18} />,
                  title: '3 new jobs match your profile',
                  message: 'Greenhouse · Anthropic, Vercel, Linear',
                })
              }
            >
              Trigger info
            </Button>
            <Button
              variant="light"
              onClick={() =>
                modals.openConfirmModal({
                  title: 'Export profile as JSON',
                  children: (
                    <Text size="sm">
                      Downloads everything in your profile and settings as a single JSON file. Import it on another browser to migrate. Your API key is not included.
                    </Text>
                  ),
                  labels: { confirm: 'Download', cancel: 'Cancel' },
                  onConfirm: () =>
                    notifications.show({
                      color: 'teal',
                      icon: <IconCheck size={18} />,
                      title: 'profile.json downloaded',
                      message: 'Drop it into another browser to import.',
                    }),
                })
              }
            >
              Open confirm modal
            </Button>
          </Group>
        </Section>
      </Stack>
    </Container>
  );
}

/* ---------- helpers ---------- */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Stack gap="md">
      <Stack gap={2}>
        <Title order={2} fw={600}>
          {title}
        </Title>
        {description ? (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        ) : null}
      </Stack>
      {children}
      <Divider mt="md" />
    </Stack>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof IconUser;
  label: string;
  value: string;
  hint?: string;
}) {
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

function CostButton({
  icon,
  label,
  tokens,
  variant = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  tokens: string;
  variant?: 'filled' | 'default' | 'light';
}) {
  return (
    <Tooltip
      label="Estimated tokens. Actual cost is computed from Anthropic's usage response after the call and stamped on the artifact."
      withArrow
    >
      <Button variant={variant} leftSection={icon}>
        <Group gap={6} wrap="nowrap">
          <span>{label}</span>
          <Text
            component="span"
            size="xs"
            c={variant === 'filled' ? 'white' : 'dimmed'}
            opacity={variant === 'filled' ? 0.75 : 1}
            ff="monospace"
          >
            {tokens}
          </Text>
        </Group>
      </Button>
    </Tooltip>
  );
}

import { fitBandToMantineColor, scoreToFitBand } from '@/lib/jobs/scoreToFitBand';
import { EJobStatus } from '@/lib/storage/types/EJobStatus';
import { ESourceId } from '@/lib/storage/types/ESourceId';

type TPreviewJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  source: ESourceId;
  fitScore: number;
  status: EJobStatus;
  postedAgo: string;
};

const SAMPLE_JOBS: TPreviewJob[] = [
  {
    id: '1',
    title: 'Staff Frontend Engineer, Design Systems',
    company: 'Anthropic',
    location: 'San Francisco · Remote',
    remote: true,
    source: ESourceId.Greenhouse,
    fitScore: 92,
    status: EJobStatus.New,
    postedAgo: '2 days ago',
  },
  {
    id: '2',
    title: 'Senior Software Engineer, Frontend Platform',
    company: 'Vercel',
    location: 'Remote',
    remote: true,
    source: ESourceId.Lever,
    fitScore: 78,
    status: EJobStatus.Saved,
    postedAgo: '4 days ago',
  },
  {
    id: '3',
    title: 'Frontend Engineer',
    company: 'Linear',
    location: 'Remote (US)',
    remote: true,
    source: ESourceId.Greenhouse,
    fitScore: 64,
    status: EJobStatus.New,
    postedAgo: '1 week ago',
  },
  {
    id: '4',
    title: 'Senior UI Engineer (Mobile)',
    company: 'Acme',
    location: 'New York, NY',
    remote: false,
    source: ESourceId.Lever,
    fitScore: 41,
    status: EJobStatus.New,
    postedAgo: '2 weeks ago',
  },
];

function JobRow({ job }: { job: TPreviewJob }) {
  const band = scoreToFitBand(job.fitScore);
  const fitColor = fitBandToMantineColor(band);
  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="md">
        <Group gap="md" wrap="nowrap" align="flex-start" style={{ flex: 1, minWidth: 0 }}>
          <RingProgress
            size={56}
            thickness={5}
            roundCaps
            sections={[{ value: job.fitScore, color: fitColor }]}
            label={
              <Text ta="center" size="xs" fw={700}>
                {job.fitScore}
              </Text>
            }
          />
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text fw={600} truncate>
              {job.title}
            </Text>
            <Group gap={6} c="dimmed">
              <IconBuildingSkyscraper size={14} stroke={1.6} />
              <Text size="sm">{job.company}</Text>
              <Text size="sm">·</Text>
              <IconMapPin size={14} stroke={1.6} />
              <Text size="sm" truncate>
                {job.location}
              </Text>
            </Group>
            <Group gap={6} mt={2}>
              <Badge size="xs" variant="light" color="gray">
                {job.source}
              </Badge>
              {job.remote ? (
                <Badge size="xs" variant="light" color="teal">
                  Remote
                </Badge>
              ) : null}
              {job.status === EJobStatus.Saved ? (
                <Badge size="xs" variant="light" color="indigo">
                  Saved
                </Badge>
              ) : null}
              {job.status === EJobStatus.Applied ? (
                <Badge size="xs" variant="light" color="violet">
                  Applied
                </Badge>
              ) : null}
              <Text size="xs" c="dimmed">
                {job.postedAgo}
              </Text>
            </Group>
          </Stack>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Tooltip label="Open posting" withArrow>
            <ActionIcon variant="default" aria-label="Open posting">
              <IconExternalLink size={16} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
          <Button size="xs" variant="light" leftSection={<IconSparkles size={14} stroke={1.6} />}>
            Tailor
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}

function StreamingResumePreview() {
  const [streamed, setStreamed] = useState(true);
  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Switch
          size="sm"
          checked={streamed}
          onChange={(e) => setStreamed(e.currentTarget.checked)}
          label="Show streamed state"
        />
      </Group>
      <Paper p="md" withBorder bg="var(--mantine-color-gray-0)">
        {streamed ? (
          <Stack gap={8}>
            <Text size="sm" ff="monospace" style={{ whiteSpace: 'pre-wrap' }}>
              {`# Ada Lovelace
**Staff Frontend Engineer** · ada@example.com · linkedin.com/in/ada

## Summary
Frontend engineer with 8 years building design systems and developer
experience at scale. Recently shipped a multi-brand component library
that cut feature delivery time by 40% across 6 product teams.

## Experience

### Staff Frontend Engineer · Stripe — 2022–Present
- Led the rebuild of Stripe's internal component library, adopted
  by 6 teams and reducing duplicated work by 40%`}
              <Text component="span" c="dimmed">
                {' '}
                _continuing…_
              </Text>
            </Text>
          </Stack>
        ) : (
          <Stack gap="xs">
            <Group gap="xs">
              <IconCircleDashed size={16} stroke={1.6} className="animate-spin" />
              <Text size="sm" c="dimmed">
                Tailoring with ic-technical template…
              </Text>
            </Group>
            <Progress value={45} animated />
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}

/**
 * A scaled-down preview of what /resume/[id]/print would render — same CSS, just
 * sized to fit a kitchen-sink card. Real print route uses @page Letter rules
 * and removes the rounded border.
 */
function ResumePrintMock() {
  return (
    <Box
      style={{
        width: rem(612), // ~8.5" at 72dpi
        background: 'white',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.08)',
        borderRadius: 4,
        padding: `${rem(36)} ${rem(40)}`,
        color: '#0f172a',
        fontFamily: 'var(--font-sans, Geist), sans-serif',
        fontSize: rem(10.5),
        lineHeight: 1.4,
      }}
    >
      <Stack gap={6} mb={14}>
        <Text
          style={{
            fontSize: rem(22),
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--mantine-color-indigo-7)',
            lineHeight: 1.15,
          }}
        >
          Ada Lovelace
        </Text>
        <Text style={{ fontSize: rem(11), color: '#475569' }}>
          Staff Frontend Engineer · San Francisco, CA · ada@example.com · linkedin.com/in/ada · github.com/ada
        </Text>
      </Stack>

      <Box style={{ height: 1, background: '#e2e8f0', margin: `${rem(8)} 0 ${rem(14)}` }} />

      <ResumeSection title="Summary">
        Frontend engineer with 8 years building design systems and developer experience at scale. Most recently led
        the rebuild of Stripe&apos;s internal component library, adopted by 6 product teams and reducing duplicated
        work by ~40%. I optimize for the boring parts so the interesting parts land safely.
      </ResumeSection>

      <ResumeSection title="Experience">
        <ResumeRole
          title="Staff Frontend Engineer"
          company="Stripe"
          dates="2022 – Present"
          bullets={[
            'Led the rebuild of the internal component library, now adopted by 6 product teams across 14 surfaces.',
            'Established the design-system contribution model; reduced new-component intake time from 2 weeks to 3 days.',
            'Shipped accessibility audit automation that caught 200+ violations before merge over 12 months.',
          ]}
        />
        <ResumeRole
          title="Senior Frontend Engineer"
          company="Vercel"
          dates="2019 – 2022"
          bullets={[
            'Owned the dashboard composition layer used by every internal team; cut p95 first-paint by 38%.',
            'Drove the Next.js 13 migration across 4 product surfaces with zero customer-visible regressions.',
            'Mentored 3 engineers from L3 → L4 with structured project rotation.',
          ]}
        />
        <ResumeRole
          title="Frontend Engineer"
          company="Linear"
          dates="2017 – 2019"
          bullets={[
            'Built the issue-list virtualization layer that handles 50k+ items at 60fps in Chrome.',
            'Authored the first internal accessibility playbook, since adopted across the engineering org.',
          ]}
        />
      </ResumeSection>

      <ResumeSection title="Skills">
        <Text style={{ fontSize: rem(10.5), color: '#0f172a' }}>
          TypeScript · React · Next.js · Design systems · Accessibility (WCAG 2.2) · Mantine · Radix · Storybook ·
          Tailwind · Web performance · Playwright · Vitest · Figma tokens
        </Text>
      </ResumeSection>

      <ResumeSection title="Education" last>
        <ResumeRole
          title="B.S. Computer Science"
          company="UC Berkeley"
          dates="2013 – 2017"
          bullets={[]}
          tight
        />
      </ResumeSection>
    </Box>
  );
}

function ResumeSection({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <Box mb={last ? 0 : 14}>
      <Text
        style={{
          fontSize: rem(11),
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--mantine-color-indigo-7)',
          marginBottom: rem(6),
        }}
      >
        {title}
      </Text>
      <Box>{children}</Box>
    </Box>
  );
}

function ResumeRole({
  title,
  company,
  dates,
  bullets,
  tight,
}: {
  title: string;
  company: string;
  dates: string;
  bullets: string[];
  tight?: boolean;
}) {
  return (
    <Box mb={tight ? 0 : 10}>
      <Group justify="space-between" align="baseline" wrap="nowrap" gap="md">
        <Text style={{ fontSize: rem(11), fontWeight: 600 }}>
          {title} · <Text component="span" style={{ fontWeight: 400 }}>{company}</Text>
        </Text>
        <Text style={{ fontSize: rem(10), color: '#64748b', whiteSpace: 'nowrap' }}>{dates}</Text>
      </Group>
      {bullets.length > 0 ? (
        <Box component="ul" style={{ margin: `${rem(4)} 0 0 ${rem(14)}`, padding: 0 }}>
          {bullets.map((b, i) => (
            <Box
              component="li"
              key={i}
              style={{ fontSize: rem(10.5), lineHeight: 1.4, marginBottom: rem(2) }}
            >
              {b}
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
