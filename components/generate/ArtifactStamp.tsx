import { Group, Stack, Text } from '@mantine/core';

import { formatTokens } from '@/lib/ai/format';

import type { IArtifactStampProps } from './types/IArtifactStampProps';

export function ArtifactStamp({ artifact, compact }: IArtifactStampProps) {
  if (!artifact.usage) return null;
  const {
    inputTokens,
    cacheReadInputTokens,
    cacheCreationInputTokens,
    outputTokens,
  } = artifact.usage;
  const totalIn =
    (inputTokens ?? 0) + (cacheReadInputTokens ?? 0) + (cacheCreationInputTokens ?? 0);

  if (compact) {
    return (
      <Text size="xs" c="dimmed" ff="monospace">
        {formatTokens(totalIn)} in → {formatTokens(outputTokens)} out
      </Text>
    );
  }

  return (
    <Group gap="md" wrap="nowrap" align="flex-start">
      <Stack gap={0} align="flex-end">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lh={1}>
          Input tokens
        </Text>
        <Text size="sm" fw={500} ff="monospace">
          {formatTokens(totalIn)}
        </Text>
      </Stack>
      <Stack gap={0} align="flex-end">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lh={1}>
          Output tokens
        </Text>
        <Text size="sm" fw={500} ff="monospace">
          {formatTokens(outputTokens)}
        </Text>
      </Stack>
      {cacheReadInputTokens > 0 ? (
        <Stack gap={0} align="flex-end">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lh={1}>
            Cached read
          </Text>
          <Text size="sm" fw={500} ff="monospace" c="teal">
            {formatTokens(cacheReadInputTokens)}
          </Text>
        </Stack>
      ) : null}
    </Group>
  );
}
