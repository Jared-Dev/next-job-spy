'use client';

import { Button, Chip, Group, Stack, Textarea } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import { useState } from 'react';

import type { IRefinementBarProps } from './types/IRefinementBarProps';

const QUICK_ACTIONS = [
  'Trim to one page',
  'Lead bullets with metrics',
  'Punchier summary',
  'More frontend infra emphasis',
  'Cut the oldest role to 2 bullets',
  'Surface more JD keywords',
];

export function RefinementBar({ onSubmit, busy, disabled }: IRefinementBarProps) {
  const [value, setValue] = useState('');

  async function handleSubmit() {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    await onSubmit(trimmed);
    setValue('');
  }

  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="wrap">
        {QUICK_ACTIONS.map((action) => (
          <Chip
            key={action}
            checked={false}
            size="xs"
            variant="light"
            onClick={() => setValue((prev) => (prev ? `${prev}\n${action}` : action))}
            disabled={disabled || busy}
          >
            {action}
          </Chip>
        ))}
      </Group>
      <Group gap="sm" align="flex-end" wrap="nowrap">
        <Textarea
          placeholder="What should change? Be specific."
          autosize
          minRows={2}
          maxRows={5}
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          disabled={disabled || busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          style={{ flex: 1 }}
        />
        <Button
          onClick={handleSubmit}
          loading={busy}
          disabled={disabled || value.trim().length === 0}
          leftSection={<IconSparkles size={16} stroke={1.6} />}
        >
          Refine
        </Button>
      </Group>
    </Stack>
  );
}
