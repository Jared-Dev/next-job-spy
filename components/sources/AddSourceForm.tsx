'use client';

import {
  Anchor,
  Badge,
  Button,
  Checkbox,
  Group,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from '@mantine/core';
import { useMemo, useState } from 'react';

import { listJobSources } from '@/lib/jobs/registry';
import type { IJobSource } from '@/lib/jobs/types/IJobSource';
import type { IJobSourceParamField } from '@/lib/jobs/types/IJobSourceParamField';
import { ESourceId } from '@/lib/storage/types/ESourceId';
import type { ISourceConfig } from '@/lib/storage/types/ISourceConfig';

import type { IAddSourceFormProps } from './types/IAddSourceFormProps';

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface IParamState {
  checked: string[];
  custom: string[];
}

function initialParamState(_field: IJobSourceParamField): IParamState {
  return { checked: [], custom: [] };
}

function paramValues(state: IParamState): string[] {
  const all = [...state.checked, ...state.custom];
  return Array.from(new Set(all.map((v) => v.trim()).filter((v) => v.length > 0)));
}

function buildConfigs(
  source: IJobSource,
  paramStates: Record<string, IParamState>,
): ISourceConfig[] {
  const primary = source.paramFields[0];
  const otherFields = source.paramFields.slice(1);
  if (!primary) return [];

  const primaryValues = paramValues(paramStates[primary.key] ?? { checked: [], custom: [] });
  if (primaryValues.length === 0) {
    if (primary.required) return [];
    primaryValues.push('');
  }

  const sharedExtras: Record<string, string> = {};
  for (const f of otherFields) {
    const vs = paramValues(paramStates[f.key] ?? { checked: [], custom: [] });
    if (vs.length > 0) sharedExtras[f.key] = vs[0];
  }

  return primaryValues.map((value) => {
    const params: Record<string, string> = { ...sharedExtras };
    if (value.length > 0) params[primary.key] = value;
    const label = labelFor(primary, value, source);
    return {
      id: generateId(),
      sourceId: source.id,
      enabled: true,
      label,
      params,
    };
  });
}

function labelFor(field: IJobSourceParamField, value: string, source: IJobSource): string {
  if (value.length === 0) return source.label;
  const known = field.knownOptions?.find((o) => o.value === value);
  return known ? `${source.label} · ${known.label}` : `${source.label} · ${value}`;
}

export function AddSourceForm({ onAdd, onCancel }: IAddSourceFormProps) {
  const sources = listJobSources();
  const [sourceId, setSourceId] = useState<ESourceId>(sources[0].id);
  const selected = useMemo(() => sources.find((s) => s.id === sourceId)!, [sources, sourceId]);

  const [paramStates, setParamStates] = useState<Record<string, IParamState>>(() =>
    Object.fromEntries(selected.paramFields.map((f) => [f.key, initialParamState(f)])),
  );
  const [submitting, setSubmitting] = useState(false);

  const configs = buildConfigs(selected, paramStates);
  const canSubmit = configs.length > 0;

  function onSourceChange(value: string | null) {
    if (!value) return;
    const next = sources.find((s) => s.id === (value as ESourceId));
    if (!next) return;
    setSourceId(next.id);
    setParamStates(
      Object.fromEntries(next.paramFields.map((f) => [f.key, initialParamState(f)])),
    );
  }

  function updateParam(key: string, patch: Partial<IParamState>) {
    setParamStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onAdd(configs);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Select
          label="Source"
          data={sources.map((s) => ({ value: s.id, label: s.label }))}
          value={sourceId}
          onChange={onSourceChange}
          allowDeselect={false}
        />
        <Text size="sm" c="dimmed">
          {selected.description}
        </Text>

        {selected.paramFields.map((field) => (
          <ParamFieldEditor
            key={field.key}
            field={field}
            state={paramStates[field.key] ?? initialParamState(field)}
            onChange={(patch) => updateParam(field.key, patch)}
          />
        ))}

        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed">
            {canSubmit
              ? configs.length === 1
                ? 'Adds 1 source.'
                : `Adds ${configs.length} sources.`
              : 'Pick at least one option or type a custom value.'}
          </Text>
          <Group gap="sm">
            <Button variant="default" onClick={onCancel} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={!canSubmit}>
              {configs.length > 1 ? `Add ${configs.length} sources` : 'Add source'}
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}

interface IParamFieldEditorProps {
  field: IJobSourceParamField;
  state: IParamState;
  onChange: (patch: Partial<IParamState>) => void;
}

function ParamFieldEditor({ field, state, onChange }: IParamFieldEditorProps) {
  const hasKnown = Boolean(field.knownOptions && field.knownOptions.length > 0);

  if (!hasKnown) {
    return (
      <TextInput
        label={field.label}
        placeholder={field.placeholder}
        description={field.description}
        withAsterisk={field.required}
        value={state.custom[0] ?? ''}
        onChange={(e) => onChange({ custom: e.currentTarget.value ? [e.currentTarget.value] : [] })}
      />
    );
  }

  return (
    <Stack gap="xs">
      <Stack gap={2}>
        <Group gap="xs" align="baseline">
          <Text size="sm" fw={500}>
            {field.label}
          </Text>
          {field.required ? (
            <Text size="xs" c="red">
              *
            </Text>
          ) : null}
          {state.checked.length + state.custom.length > 0 ? (
            <Badge size="xs" variant="light" color="indigo">
              {state.checked.length + state.custom.length} picked
            </Badge>
          ) : null}
        </Group>
        {field.description ? (
          <Text size="xs" c="dimmed">
            {field.description}
          </Text>
        ) : null}
      </Stack>

      <Checkbox.Group
        value={state.checked}
        onChange={(value) => onChange({ checked: value })}
      >
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing={6} verticalSpacing={6}>
          {field.knownOptions!.map((option) => (
            <Checkbox
              key={option.value}
              value={option.value}
              label={option.label}
              size="sm"
            />
          ))}
        </SimpleGrid>
      </Checkbox.Group>

      <TagsInput
        label="Or add custom"
        placeholder={`Type ${field.placeholder ?? 'a value'} and press Enter`}
        value={state.custom}
        onChange={(value) => onChange({ custom: value })}
        clearable
      />

      <Text size="xs" c="dimmed">
        Don&apos;t see a board you want? Check{' '}
        <Anchor
          href="https://boards.greenhouse.io/"
          target="_blank"
          rel="noreferrer"
          inherit
        >
          the board host
        </Anchor>{' '}
        for the right slug,it&apos;s the path segment after the domain.
      </Text>
    </Stack>
  );
}
