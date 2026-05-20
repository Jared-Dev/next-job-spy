'use client';

import {
  Chip,
  Group,
  MultiSelect,
  NumberInput,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useMemo } from 'react';

import { adapter } from '@/lib/storage';
import { COUNTRY_LABELS } from '@/lib/jobs/inferCountry';
import { EJobStatus } from '@/lib/storage/types/EJobStatus';
import { UNKNOWN_COUNTRY_TOKEN } from '@/lib/storage/types/IJobFilters';

import type { IJobFiltersProps } from './types/IJobFiltersProps';

const STATUS_OPTIONS = [
  { value: EJobStatus.New, label: 'New' },
  { value: EJobStatus.Saved, label: 'Saved' },
  { value: EJobStatus.Applied, label: 'Applied' },
  { value: EJobStatus.Hidden, label: 'Hidden' },
];

export function JobFilters({ value, onChange, totalCount }: IJobFiltersProps) {
  const selected = value.status ?? [EJobStatus.New, EJobStatus.Saved, EJobStatus.Applied];

  // Surface only countries actually present in the user's data so the dropdown
  // doesn't bury them in 60 options most of which have zero matches.
  const allJobs = adapter.useJobs();
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
        <Text size="sm" c="dimmed">
          {totalCount} {totalCount === 1 ? 'job' : 'jobs'}
        </Text>
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

        <Switch
          size="sm"
          label="Remote only"
          checked={!!value.remoteOnly}
          onChange={(e) => onChange({ ...value, remoteOnly: e.currentTarget.checked })}
        />

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
      </Group>
    </Stack>
  );
}
