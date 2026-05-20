import { Button, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import Link from 'next/link';

import type { IEmptyStateProps } from './types/IEmptyStateProps';

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: IEmptyStateProps) {
  return (
    <Paper p="xl" withBorder radius="lg">
      <Stack align="center" gap="md" py="xl">
        <ThemeIcon size={56} radius="xl" variant="light" color="indigo">
          <Icon size={28} stroke={1.5} />
        </ThemeIcon>
        <Stack align="center" gap={4}>
          <Title order={3} fw={600}>
            {title}
          </Title>
          {description ? (
            <Text c="dimmed" ta="center" maw={420}>
              {description}
            </Text>
          ) : null}
        </Stack>
        {(primaryAction || secondaryAction) && (
          <Group gap="sm">
            {primaryAction ? (
              <Button
                component={Link}
                href={primaryAction.href}
                variant={primaryAction.variant ?? 'filled'}
              >
                {primaryAction.label}
              </Button>
            ) : null}
            {secondaryAction ? (
              <Button
                component={Link}
                href={secondaryAction.href}
                variant={secondaryAction.variant ?? 'default'}
              >
                {secondaryAction.label}
              </Button>
            ) : null}
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
