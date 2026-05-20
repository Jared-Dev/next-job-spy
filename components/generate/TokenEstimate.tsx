import { Text } from '@mantine/core';

import { formatTokens } from '@/lib/ai/format';

import type { ITokenEstimateProps } from './types/ITokenEstimateProps';

export function TokenEstimate({ inputTokens, maxOutputTokens }: ITokenEstimateProps) {
  return (
    <Text component="span" size="xs" c="dimmed" ff="monospace">
      ~{formatTokens(inputTokens)} in · ≤{formatTokens(maxOutputTokens)} out
    </Text>
  );
}
