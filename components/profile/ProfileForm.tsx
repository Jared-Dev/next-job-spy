'use client';

import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconBriefcase,
  IconCheck,
  IconCompass,
  IconExclamationCircle,
  IconLink,
  IconListCheck,
  IconPlus,
  IconSchool,
  IconSparkles,
  IconTrash,
  IconTrophy,
  IconUser,
} from '@tabler/icons-react';
import { useTransition } from 'react';

import { adapter } from '@/lib/storage';
import { ESkillStrength } from '@/lib/storage/types/ESkillStrength';
import type { IProfile } from '@/lib/storage/types/IProfile';

import { ImportProfileButton } from './ImportProfileButton';
import type { IBulletEditorProps } from './types/IBulletEditorProps';
import type { IProfileFormProps } from './types/IProfileFormProps';
import type { IProfileSectionProps } from './types/IProfileSectionProps';
import type { TProfileFormValues } from './types/TProfileFormValues';

const STRENGTH_OPTIONS = [
  { value: ESkillStrength.Familiar, label: 'Familiar' },
  { value: ESkillStrength.Proficient, label: 'Proficient' },
  { value: ESkillStrength.Advanced, label: 'Advanced' },
  { value: ESkillStrength.Expert, label: 'Expert' },
];

function toFormValues(initial: IProfile | undefined): TProfileFormValues {
  return {
    fullName: initial?.fullName ?? '',
    headline: initial?.headline ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    location: initial?.location ?? '',
    personalSiteUrl: initial?.personalSite?.url ?? '',
    personalSiteSections:
      initial?.personalSite?.sections?.map((s) => ({
        name: s.name,
        description: s.description ?? '',
      })) ?? [],
    links: initial?.links?.map((l) => ({ label: l.label, url: l.url })) ?? [],
    summary: initial?.summary ?? '',
    workHistory:
      initial?.workHistory?.map((w) => ({
        company: w.company,
        title: w.title,
        location: w.location ?? '',
        startDate: w.startDate ?? '',
        endDate: w.endDate ?? '',
        current: w.current ?? false,
        summary: w.summary ?? '',
        highlights: w.highlights ?? [],
      })) ?? [],
    education:
      initial?.education?.map((e) => ({
        school: e.school,
        degree: e.degree ?? '',
        field: e.field ?? '',
        startDate: e.startDate ?? '',
        endDate: e.endDate ?? '',
        notes: e.notes ?? '',
      })) ?? [],
    skills:
      initial?.skills?.map((s) => ({ name: s.name, strength: s.strength })) ?? [],
    achievements: initial?.achievements ?? [],
    goals: initial?.careerContext?.goals ?? '',
    lookingFor: initial?.careerContext?.lookingFor ?? '',
    avoiding: initial?.careerContext?.avoiding ?? '',
    workingStyle: initial?.careerContext?.workingStyle ?? '',
    sourceMarkdown: initial?.sourceMarkdown ?? '',
  };
}

function toProfile(values: TProfileFormValues): IProfile {
  const trim = (s: string) => s.trim();
  const emptyToUndef = (s: string) => (s.trim().length === 0 ? undefined : s.trim());

  const goals = emptyToUndef(values.goals);
  const lookingFor = emptyToUndef(values.lookingFor);
  const avoiding = emptyToUndef(values.avoiding);
  const workingStyle = emptyToUndef(values.workingStyle);
  const hasCareerContext = goals || lookingFor || avoiding || workingStyle;

  const siteUrl = emptyToUndef(values.personalSiteUrl);

  return {
    fullName: emptyToUndef(values.fullName),
    headline: emptyToUndef(values.headline),
    email: emptyToUndef(values.email),
    phone: emptyToUndef(values.phone),
    location: emptyToUndef(values.location),
    personalSite: siteUrl
      ? {
          url: siteUrl,
          sections: values.personalSiteSections
            .filter((s) => s.name.trim().length > 0)
            .map((s) => ({
              name: trim(s.name),
              description: emptyToUndef(s.description),
            })),
        }
      : undefined,
    links: values.links
      .map((l) => ({ label: trim(l.label), url: trim(l.url) }))
      .filter((l) => l.label && l.url),
    summary: emptyToUndef(values.summary),
    workHistory: values.workHistory
      .filter((w) => w.company.trim() || w.title.trim())
      .map((w) => ({
        company: trim(w.company),
        title: trim(w.title),
        location: emptyToUndef(w.location),
        startDate: emptyToUndef(w.startDate),
        endDate: w.current ? undefined : emptyToUndef(w.endDate),
        current: w.current || undefined,
        summary: emptyToUndef(w.summary),
        highlights: w.highlights.filter((h) => h.trim().length > 0),
      })),
    education: values.education
      .filter((e) => e.school.trim())
      .map((e) => ({
        school: trim(e.school),
        degree: emptyToUndef(e.degree),
        field: emptyToUndef(e.field),
        startDate: emptyToUndef(e.startDate),
        endDate: emptyToUndef(e.endDate),
        notes: emptyToUndef(e.notes),
      })),
    skills: values.skills
      .filter((s) => s.name.trim().length > 0)
      .map((s) => ({ name: trim(s.name), strength: s.strength })),
    achievements: values.achievements.map(trim).filter(Boolean),
    careerContext: hasCareerContext
      ? { goals, lookingFor, avoiding, workingStyle }
      : undefined,
    sourceMarkdown: emptyToUndef(values.sourceMarkdown),
  };
}

const EMPTY_WORK = {
  company: '',
  title: '',
  location: '',
  startDate: '',
  endDate: '',
  current: false,
  summary: '',
  highlights: [] as string[],
};

const EMPTY_EDUCATION = {
  school: '',
  degree: '',
  field: '',
  startDate: '',
  endDate: '',
  notes: '',
};

const EMPTY_SKILL = { name: '', strength: ESkillStrength.Proficient };

export function ProfileForm(_props: IProfileFormProps) {
  const profile = adapter.useProfile();

  if (profile === undefined) {
    return (
      <Stack gap="md">
        <Skeleton height={200} />
        <Skeleton height={300} />
        <Skeleton height={300} />
      </Stack>
    );
  }

  return <ProfileFormInner initial={profile} />;
}

function ProfileFormInner({ initial }: { initial: IProfile }) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<TProfileFormValues>({
    initialValues: toFormValues(initial),
    validate: {
      email: (v) =>
        v.trim().length === 0 || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())
          ? null
          : 'Looks like an invalid email',
      links: {
        url: (v) =>
          v.trim().length === 0 || /^https?:\/\//.test(v.trim())
            ? null
            : 'URL must start with http:// or https://',
      },
    },
  });

  return (
    <form
      onSubmit={form.onSubmit((values) => {
        startTransition(async () => {
          try {
            await adapter.saveProfile(toProfile(values));
            notifications.show({
              color: 'teal',
              icon: <IconCheck size={18} />,
              title: 'Profile saved',
              message: "We'll use this to rank jobs and tailor resumes.",
            });
            form.resetDirty();
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
        <Paper p="md" withBorder>
          <Group justify="space-between" wrap="nowrap" gap="md">
            <Stack gap={2}>
              <Text fw={500} size="sm">
                Have a profile written up?
              </Text>
              <Text size="xs" c="dimmed">
                Import a Markdown file (see profile.example.md) — Claude distills it
                into the fields below for you to review.
              </Text>
            </Stack>
            <ImportProfileButton
              onImport={(imported) => form.setValues(toFormValues(imported))}
            />
          </Group>
        </Paper>

        <Section title="Identity" icon={IconUser} description="The basics any application will ask for.">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput label="Full name" placeholder="Ada Lovelace" {...form.getInputProps('fullName')} />
            <TextInput
              label="Headline"
              placeholder="Staff Frontend Engineer"
              description="Short professional title"
              {...form.getInputProps('headline')}
            />
            <TextInput label="Email" placeholder="you@example.com" {...form.getInputProps('email')} />
            <TextInput label="Phone" placeholder="(555) 123-4567" {...form.getInputProps('phone')} />
            <TextInput
              label="Location"
              placeholder="San Francisco, CA"
              {...form.getInputProps('location')}
              style={{ gridColumn: '1 / -1' }}
            />
          </SimpleGrid>

          <Stack gap="xs" mt="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text size="sm" fw={500}>
                  Personal site
                </Text>
                <Text size="xs" c="dimmed">
                  Your portfolio / personal site — the recruiter-facing hub. Goes on every generated resume.
                </Text>
              </Stack>
              {form.values.personalSiteUrl.trim().length > 0 ? (
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconPlus size={14} />}
                  onClick={() =>
                    form.insertListItem('personalSiteSections', {
                      name: '',
                      description: '',
                    })
                  }
                >
                  Add section
                </Button>
              ) : null}
            </Group>
            <TextInput
              placeholder="https://you.example.com"
              leftSection={<IconLink size={14} />}
              {...form.getInputProps('personalSiteUrl')}
            />
            {form.values.personalSiteUrl.trim().length > 0 ? (
              form.values.personalSiteSections.length === 0 ? (
                <Text size="xs" c="dimmed">
                  Optionally list what&apos;s on the site — Portfolio, Blog, Case
                  studies, etc. Each section can carry a one-line note for context.
                </Text>
              ) : (
                <Stack gap="xs">
                  {form.values.personalSiteSections.map((_, idx) => (
                    <Group key={idx} gap="xs" align="flex-start" wrap="nowrap">
                      <TextInput
                        placeholder="Portfolio"
                        style={{ flex: '0 0 160px' }}
                        {...form.getInputProps(`personalSiteSections.${idx}.name`)}
                      />
                      <TextInput
                        placeholder="What's there — e.g. case studies of 6 shipped products"
                        style={{ flex: 1 }}
                        {...form.getInputProps(`personalSiteSections.${idx}.description`)}
                      />
                      <RemoveButton
                        onClick={() => form.removeListItem('personalSiteSections', idx)}
                      />
                    </Group>
                  ))}
                </Stack>
              )
            ) : null}
          </Stack>

          <Stack gap="xs" mt="md">
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                Links
              </Text>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={() => form.insertListItem('links', { label: '', url: '' })}
              >
                Add link
              </Button>
            </Group>
            {form.values.links.length === 0 ? (
              <Text size="sm" c="dimmed">
                LinkedIn, GitHub, portfolio, anything you&apos;d put on a resume.
              </Text>
            ) : (
              <Stack gap="xs">
                {form.values.links.map((_, idx) => (
                  <Group key={idx} gap="xs" align="flex-end" wrap="nowrap">
                    <TextInput
                      placeholder="LinkedIn"
                      style={{ flex: '0 0 140px' }}
                      {...form.getInputProps(`links.${idx}.label`)}
                    />
                    <TextInput
                      placeholder="https://…"
                      style={{ flex: 1 }}
                      leftSection={<IconLink size={14} />}
                      {...form.getInputProps(`links.${idx}.url`)}
                    />
                    <RemoveButton onClick={() => form.removeListItem('links', idx)} />
                  </Group>
                ))}
              </Stack>
            )}
          </Stack>
        </Section>

        <Section
          title="Summary"
          icon={IconSparkles}
          description="A short paragraph in your voice — kept when tailoring per-job resumes. Minimum 2 sentences; 3–5 (~80–120 words) recommended. Longer is fine."
        >
          <Textarea
            placeholder="I'm a frontend engineer with 8 years of experience…"
            autosize
            minRows={3}
            maxRows={10}
            {...form.getInputProps('summary')}
          />
        </Section>

        <Section
          title="Career context"
          icon={IconCompass}
          description="Where you're headed. Sharpens ranking and frames tailored resumes. Every field is optional — fill what you can."
        >
          <Stack gap="md">
            <Textarea
              label="Career goals"
              description="Where you want to go next. A sentence minimum; a short paragraph recommended."
              autosize
              minRows={2}
              maxRows={6}
              placeholder="I want to move into a staff-level role focused on…"
              {...form.getInputProps('goals')}
            />
            <Textarea
              label="Looking for"
              description="Concrete role attributes — titles, comp floor, remote, company stage, domains."
              autosize
              minRows={2}
              maxRows={6}
              placeholder="Remote (US), Series B–D, developer tools or fintech…"
              {...form.getInputProps('lookingFor')}
            />
            <Textarea
              label="Avoiding"
              description="Deal-breakers. Used to down-rank. Optional."
              autosize
              minRows={1}
              maxRows={5}
              placeholder="On-call-heavy roles, pure people-management…"
              {...form.getInputProps('avoiding')}
            />
            <Textarea
              label="Working style"
              description="How you work best. Helps tailoring frame you for a team. Optional; 2–4 sentences recommended."
              autosize
              minRows={2}
              maxRows={5}
              placeholder="I do my best work with autonomy and async communication…"
              {...form.getInputProps('workingStyle')}
            />
          </Stack>
        </Section>

        <Section
          title="Work history"
          icon={IconBriefcase}
          description="Most recent first. Your highlights become the seeds for ATS-tailored bullets — 2 per role minimum, 4–6 ideal."
          rightAction={
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() => form.insertListItem('workHistory', { ...EMPTY_WORK }, 0)}
            >
              Add role
            </Button>
          }
        >
          {form.values.workHistory.length === 0 ? (
            <EmptyHint text="No roles yet. Click Add role to start your work history." />
          ) : (
            <Stack gap="md">
              {form.values.workHistory.map((entry, idx) => (
                <Paper key={idx} p="md" withBorder radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between" wrap="nowrap" align="flex-start">
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" style={{ flex: 1 }}>
                        <TextInput
                          label="Title"
                          placeholder="Senior Engineer"
                          {...form.getInputProps(`workHistory.${idx}.title`)}
                        />
                        <TextInput
                          label="Company"
                          placeholder="Acme Inc."
                          {...form.getInputProps(`workHistory.${idx}.company`)}
                        />
                      </SimpleGrid>
                      <RemoveButton onClick={() => form.removeListItem('workHistory', idx)} />
                    </Group>

                    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                      <TextInput
                        label="Location"
                        placeholder="Remote / SF, CA"
                        {...form.getInputProps(`workHistory.${idx}.location`)}
                      />
                      <TextInput
                        label="Start"
                        placeholder="2022-01"
                        {...form.getInputProps(`workHistory.${idx}.startDate`)}
                      />
                      <TextInput
                        label="End"
                        placeholder="2024-06"
                        disabled={entry.current}
                        {...form.getInputProps(`workHistory.${idx}.endDate`)}
                      />
                    </SimpleGrid>

                    <Switch
                      label="Currently in this role"
                      {...form.getInputProps(`workHistory.${idx}.current`, { type: 'checkbox' })}
                    />

                    <Textarea
                      label="Role summary"
                      description="One sentence about scope and impact"
                      autosize
                      minRows={2}
                      maxRows={4}
                      placeholder="Led the design system rebuild…"
                      {...form.getInputProps(`workHistory.${idx}.summary`)}
                    />

                    <BulletEditor
                      label="Highlights"
                      description="Specifics and metrics matter — these become the bullets in tailored resumes."
                      values={entry.highlights}
                      onChange={(next) => form.setFieldValue(`workHistory.${idx}.highlights`, next)}
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Section>

        <Section
          title="Education"
          icon={IconSchool}
          description="Degrees, certifications, bootcamps."
          rightAction={
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() => form.insertListItem('education', { ...EMPTY_EDUCATION }, 0)}
            >
              Add entry
            </Button>
          }
        >
          {form.values.education.length === 0 ? (
            <EmptyHint text="No education entries yet." />
          ) : (
            <Stack gap="md">
              {form.values.education.map((_, idx) => (
                <Paper key={idx} p="md" withBorder radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between" wrap="nowrap" align="flex-start">
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" style={{ flex: 1 }}>
                        <TextInput
                          label="School"
                          placeholder="Stanford University"
                          {...form.getInputProps(`education.${idx}.school`)}
                        />
                        <TextInput
                          label="Field"
                          placeholder="Computer Science"
                          {...form.getInputProps(`education.${idx}.field`)}
                        />
                        <TextInput
                          label="Degree"
                          placeholder="B.S."
                          {...form.getInputProps(`education.${idx}.degree`)}
                        />
                        <Group gap="xs" grow>
                          <TextInput
                            label="Start"
                            placeholder="2018"
                            {...form.getInputProps(`education.${idx}.startDate`)}
                          />
                          <TextInput
                            label="End"
                            placeholder="2022"
                            {...form.getInputProps(`education.${idx}.endDate`)}
                          />
                        </Group>
                      </SimpleGrid>
                      <RemoveButton onClick={() => form.removeListItem('education', idx)} />
                    </Group>
                    <Textarea
                      label="Notes"
                      autosize
                      minRows={1}
                      maxRows={3}
                      placeholder="GPA, honors, relevant coursework…"
                      {...form.getInputProps(`education.${idx}.notes`)}
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Section>

        <Section
          title="Skills"
          icon={IconListCheck}
          description="Rate each skill's strength — ranking weights jobs against where you're strong, and tailoring leads with your best. Minimum ~8; 20–40 recommended."
          rightAction={
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() => form.insertListItem('skills', { ...EMPTY_SKILL })}
            >
              Add skill
            </Button>
          }
        >
          {form.values.skills.length === 0 ? (
            <EmptyHint text="No skills yet. Add a few — be generous, every real skill is a keyword the matcher can use." />
          ) : (
            <Stack gap="xs">
              {form.values.skills.map((_, idx) => (
                <Group key={idx} gap="xs" wrap="nowrap" align="flex-end">
                  <TextInput
                    placeholder="React"
                    style={{ flex: 1 }}
                    {...form.getInputProps(`skills.${idx}.name`)}
                  />
                  <Select
                    data={STRENGTH_OPTIONS}
                    allowDeselect={false}
                    style={{ flex: '0 0 150px' }}
                    {...form.getInputProps(`skills.${idx}.strength`)}
                  />
                  <RemoveButton onClick={() => form.removeListItem('skills', idx)} />
                </Group>
              ))}
            </Stack>
          )}
        </Section>

        <Section
          title="Achievements"
          icon={IconTrophy}
          description="Awards, certifications, talks, OSS contributions — anything outside of work history."
        >
          <BulletEditor
            label="Achievements"
            description=""
            values={form.values.achievements}
            onChange={(next) => form.setFieldValue('achievements', next)}
            hideLabel
          />
        </Section>

        <Group
          justify="flex-end"
          pos="sticky"
          bottom={0}
          py="md"
          style={{ background: 'var(--mantine-color-body)' }}
        >
          <Button type="submit" size="md" loading={isPending} disabled={!form.isDirty()}>
            Save profile
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function Section({ title, description, icon: Icon, rightAction, children }: IProfileSectionProps) {
  return (
    <Paper p="lg" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" align="flex-start">
            <Box mt={4}>
              <Icon size={20} stroke={1.6} color="var(--mantine-color-indigo-5)" />
            </Box>
            <Stack gap={2}>
              <Title order={4} fw={600}>
                {title}
              </Title>
              {description ? (
                <Text size="sm" c="dimmed">
                  {description}
                </Text>
              ) : null}
            </Stack>
          </Group>
          {rightAction}
        </Group>
        <Divider />
        {children}
      </Stack>
    </Paper>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip label="Remove" withArrow>
      <ActionIcon variant="subtle" color="red" onClick={onClick} aria-label="Remove">
        <IconTrash size={16} stroke={1.6} />
      </ActionIcon>
    </Tooltip>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <Text size="sm" c="dimmed" ta="center" py="md">
      {text}
    </Text>
  );
}

function BulletEditor({ label, description, values, onChange, hideLabel }: IBulletEditorProps) {
  return (
    <Stack gap="xs">
      {!hideLabel ? (
        <Stack gap={2}>
          <Text size="sm" fw={500}>
            {label}
          </Text>
          {description ? (
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          ) : null}
        </Stack>
      ) : null}
      {values.map((v, idx) => (
        <Group key={idx} gap="xs" align="flex-start" wrap="nowrap">
          <Textarea
            placeholder="Shipped X that improved Y by Z%"
            autosize
            minRows={1}
            maxRows={4}
            value={v}
            onChange={(e) => {
              const next = [...values];
              next[idx] = e.currentTarget.value;
              onChange(next);
            }}
            style={{ flex: 1 }}
          />
          <RemoveButton
            onClick={() => {
              const next = values.filter((_, i) => i !== idx);
              onChange(next);
            }}
          />
        </Group>
      ))}
      <Button
        size="xs"
        variant="subtle"
        leftSection={<IconPlus size={14} />}
        onClick={() => onChange([...values, ''])}
        style={{ alignSelf: 'flex-start' }}
      >
        Add bullet
      </Button>
    </Stack>
  );
}
