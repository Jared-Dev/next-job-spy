import { EJobFitBand } from './types/EJobFitBand';

export function scoreToFitBand(score: number | undefined): EJobFitBand {
  if (typeof score !== 'number') return EJobFitBand.Poor;
  if (score >= 85) return EJobFitBand.Strong;
  if (score >= 70) return EJobFitBand.Good;
  if (score >= 50) return EJobFitBand.Fair;
  return EJobFitBand.Poor;
}

const COLOR_BY_BAND: Record<EJobFitBand, string> = {
  [EJobFitBand.Strong]: 'teal',
  [EJobFitBand.Good]: 'indigo',
  [EJobFitBand.Fair]: 'yellow',
  [EJobFitBand.Poor]: 'gray',
};

export function fitBandToMantineColor(band: EJobFitBand): string {
  return COLOR_BY_BAND[band];
}
