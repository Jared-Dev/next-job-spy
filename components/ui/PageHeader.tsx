import { Group, Stack, Text, Title } from '@mantine/core';

import type { IPageHeaderProps } from './types/IPageHeaderProps';

export function PageHeader({ title, description, actions }: IPageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start" mb="lg" wrap="nowrap">
      <Stack gap={4}>
        <Title order={2} fw={600}>
          {title}
        </Title>
        {description ? (
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        ) : null}
      </Stack>
      {actions ? <Group gap="sm">{actions}</Group> : null}
    </Group>
  );
}
