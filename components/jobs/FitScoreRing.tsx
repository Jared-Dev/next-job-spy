import { RingProgress, Text } from '@mantine/core';

import { fitBandToMantineColor, scoreToFitBand } from '@/lib/jobs/scoreToFitBand';

import type { IFitScoreRingProps } from './types/IFitScoreRingProps';

export function FitScoreRing({ score, size = 56 }: IFitScoreRingProps) {
  const band = scoreToFitBand(score);
  const color = fitBandToMantineColor(band);
  const value = typeof score === 'number' ? score : 0;
  return (
    <RingProgress
      size={size}
      thickness={Math.max(4, Math.round(size * 0.09))}
      roundCaps
      sections={[{ value, color }]}
      label={
        <Text ta="center" size="xs" fw={700}>
          {typeof score === 'number' ? Math.round(score) : '—'}
        </Text>
      }
    />
  );
}
