'use client';

import {
  ActionIcon,
  Anchor,
  Chip,
  Divider,
  Group,
  HoverCard,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconArrowsSort, IconInfoCircle, IconSearch } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

import { adapter } from '@/lib/storage';
import { COUNTRY_LABELS } from '@/lib/jobs/inferCountry';
import { languageDisplayName } from '@/lib/jobs/detectLanguage';
import { EJobSort } from '@/lib/storage/types/EJobSort';
import { EJobStatus } from '@/lib/storage/types/EJobStatus';
import { ESourceId } from '@/lib/storage/types/ESourceId';
import {
  UNKNOWN_COUNTRY_TOKEN,
  UNKNOWN_LANGUAGE_TOKEN,
} from '@/lib/storage/types/IJobFilters';
import {
  getScreeningStatsAction,
  type IScreeningStats,
} from '@/lib/storage/local/actions/screening';

import type { IJobFiltersProps } from './types/IJobFiltersProps';

const STATUS_OPTIONS = [
  { value: EJobStatus.New, label: 'New' },
  { value: EJobStatus.Saved, label: 'Saved' },
  { value: EJobStatus.Applied, label: 'Applied' },
  { value: EJobStatus.Hidden, label: 'Hidden' },
];

const SORT_OPTIONS = [
  { value: EJobSort.Ranking, label: 'Ranking' },
  { value: EJobSort.NewestDiscovered, label: 'Newest discovered' },
  { value: EJobSort.PostedDate, label: 'Posted date' },
  { value: EJobSort.Company, label: 'Company A to Z' },
];

export function JobFilters({ value, onChange, totalCount }: IJobFiltersProps) {
  const selected = value.status ?? [EJobStatus.New, EJobStatus.Saved, EJobStatus.Applied];

  // Surface only countries actually present in the user's data so the dropdown
  // doesn't bury them in 60 options most of which have zero matches.
  const allJobs = adapter.useJobs();
  const settings = adapter.useSettings();
  // The language search filter only makes sense when the user has
  // imported jobs from more than one language. With a single allowed
  // language at the ingest gate every visible row is in that language,
  // so a "language" chip would always be a no-op.
  const showLanguageFilter = (settings?.allowedLanguages?.length ?? 0) > 1;

  // Filter-breakdown stats for the info popover. Refetch when the job
  // list shifts (cascade ran, ingest landed, audit promoted a row).
  const [stats, setStats] = useState<IScreeningStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getScreeningStatsAction().then((fresh) => {
      if (!cancelled) setStats(fresh);
    });
    return () => {
      cancelled = true;
    };
  }, [allJobs]);

  const countryOptions = useMemo(() => {
    if (!allJobs) return [];
    const seen = new Set<string>();
    let hasUnknown = false;
    for (const job of allJobs) {
      if (job.country) seen.add(job.country);
      else hasUnknown = true;
    }
    const opts = Array.from(seen)
      .sort((a, b) => (COUNTRY_LABELS[a] ?? a).localeCompare(COUNTRY_LABELS[b] ?? b))
      .map((code) => ({ value: code, label: COUNTRY_LABELS[code] ?? code }));
    if (hasUnknown) opts.push({ value: UNKNOWN_COUNTRY_TOKEN, label: '(Unknown)' });
    return opts;
  }, [allJobs]);

  const languageOptions = useMemo(() => {
    if (!allJobs) return [];
    const seen = new Set<string>();
    let hasUnknown = false;
    for (const job of allJobs) {
      if (job.language) seen.add(job.language);
      else hasUnknown = true;
    }
    const opts = Array.from(seen)
      .sort((a, b) => languageDisplayName(a).localeCompare(languageDisplayName(b)))
      .map((code) => ({ value: code, label: languageDisplayName(code) }));
    if (hasUnknown) opts.push({ value: UNKNOWN_LANGUAGE_TOKEN, label: '(Undetected)' });
    return opts;
  }, [allJobs]);

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap">
        <TextInput
          placeholder="Search title, company, location…"
          leftSection={<IconSearch size={16} stroke={1.6} />}
          value={value.search ?? ''}
          onChange={(e) => onChange({ ...value, search: e.currentTarget.value })}
          style={{ flex: 1, maxWidth: 360 }}
        />
        <Group gap="xs" wrap="nowrap">
          <Select
            size="xs"
            data={SORT_OPTIONS}
            value={value.sortBy ?? EJobSort.Ranking}
            onChange={(next) =>
              onChange({ ...value, sortBy: (next ?? EJobSort.Ranking) as EJobSort })
            }
            allowDeselect={false}
            leftSection={<IconArrowsSort size={14} stroke={1.6} />}
            comboboxProps={{ position: 'bottom-end' }}
            aria-label="Sort jobs"
            style={{ width: 200 }}
          />
          <Text size="sm" c="dimmed">
            {totalCount} {totalCount === 1 ? 'job' : 'jobs'}
          </Text>
          <FilteredOutInfo stats={stats} />
        </Group>
      </Group>

      <Group gap="xs" wrap="wrap" align="center">
        <Chip.Group
          multiple
          value={selected}
          onChange={(next) =>
            onChange({ ...value, status: next as EJobStatus[] })
          }
        >
          {STATUS_OPTIONS.map((opt) => (
            <Chip key={opt.value} value={opt.value} size="xs" variant="light">
              {opt.label}
            </Chip>
          ))}
        </Chip.Group>

        <Chip
          size="xs"
          variant="light"
          checked={!!value.remoteOnly}
          onChange={(checked) => onChange({ ...value, remoteOnly: checked })}
        >
          Remote only
        </Chip>

        <Chip
          size="xs"
          variant="light"
          checked={(value.sources ?? []).includes(ESourceId.Manual)}
          onChange={(checked) =>
            onChange({
              ...value,
              sources: checked ? [ESourceId.Manual] : undefined,
            })
          }
        >
          Manual only
        </Chip>

        <NumberInput
          size="xs"
          placeholder="Min fit"
          min={0}
          max={100}
          value={value.minFitScore ?? ''}
          onChange={(v) =>
            onChange({
              ...value,
              minFitScore: typeof v === 'number' ? v : undefined,
            })
          }
          style={{ width: 110 }}
        />

        <MultiSelect
          size="xs"
          placeholder="Any country"
          data={countryOptions}
          value={value.countries ?? []}
          onChange={(next) =>
            onChange({ ...value, countries: next.length > 0 ? next : undefined })
          }
          searchable
          clearable
          maxValues={6}
          comboboxProps={{ position: 'bottom-start' }}
          style={{ minWidth: 200, flex: '0 1 280px' }}
        />

        {showLanguageFilter ? (
          <MultiSelect
            size="xs"
            placeholder="Any language"
            data={languageOptions}
            value={value.languages ?? []}
            onChange={(next) =>
              onChange({ ...value, languages: next.length > 0 ? next : undefined })
            }
            searchable
            clearable
            maxValues={6}
            comboboxProps={{ position: 'bottom-start' }}
            style={{ minWidth: 180, flex: '0 1 240px' }}
          />
        ) : null}
      </Group>
    </Stack>
  );
}

/**
 * Info-circle button next to the visible-jobs count. The visible total
 * excludes anything the cascade dropped or marked expired; this popover
 * shows that excluded breakdown so the user knows how many jobs are
 * hidden and why. Links to Settings where the spot-check audit lives.
 */
function FilteredOutInfo({ stats }: { stats: IScreeningStats | null }) {
  if (!stats) return null;
  const embDropped = stats.embedding.dropped;
  const localDropped = stats.local.dropped;
  const langDropped = stats.languageDropped;
  const expired = stats.expired;
  const hidden = embDropped + localDropped + langDropped + expired;
  if (hidden === 0) return null;

  return (
    <HoverCard width={300} shadow="md" position="bottom-end" withArrow openDelay={120}>
      <HoverCard.Target>
        <ActionIcon
          variant="subtle"
          size="sm"
          color="gray"
          aria-label={`${hidden} jobs hidden by the cascade. Hover for breakdown.`}
        >
          <IconInfoCircle size={16} stroke={1.6} />
        </ActionIcon>
      </HoverCard.Target>
      <HoverCard.Dropdown>
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            {hidden} hidden by the cascade
          </Text>
          <Stack gap={4}>
            {embDropped > 0 ? (
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Dropped by embedding screen
                </Text>
                <Text size="xs" fw={500}>
                  {embDropped}
                </Text>
              </Group>
            ) : null}
            {localDropped > 0 ? (
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Dropped by local screen
                </Text>
                <Text size="xs" fw={500}>
                  {localDropped}
                </Text>
              </Group>
            ) : null}
            {langDropped > 0 ? (
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Wrong language
                </Text>
                <Text size="xs" fw={500}>
                  {langDropped}
                </Text>
              </Group>
            ) : null}
            {expired > 0 ? (
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Posting expired
                </Text>
                <Text size="xs" fw={500}>
                  {expired}
                </Text>
              </Group>
            ) : null}
          </Stack>
          <Divider />
          <Text size="xs" c="dimmed">
            Worried about false negatives? Run a spot-check audit from{' '}
            <Anchor href="/settings" size="xs">
              Settings
            </Anchor>{' '}
            to sample dropped jobs and recalibrate.
          </Text>
        </Stack>
      </HoverCard.Dropdown>
    </HoverCard>
  );
}
