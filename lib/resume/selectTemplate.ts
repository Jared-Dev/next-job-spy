import { ETemplateId } from '@/lib/storage/types/ETemplateId';
import type { IProfile } from '@/lib/storage/types/IProfile';

import {
  ETemplateConfidence,
  type ITemplateSuggestion,
} from './types/ITemplateSuggestion';

const MANAGER_TOKENS = [
  'manager',
  'director',
  'head of',
  'chief',
  'vp ',
  'vice president',
  ' lead', // " lead" to avoid matching "lead engineer" though common, accept as borderline
  ' staff',
  'principal',
];

const TECHNICAL_TOKENS = [
  'engineer',
  'developer',
  'architect',
  'scientist',
  'analyst',
  'sre',
  'devops',
  'infrastructure',
  'platform',
  ' data ',
  ' ml ',
];

const GENERALIST_TOKENS = [
  'product manager',
  ' pm ',
  ' pm,',
  'operations',
  'strategy',
  'business development',
  ' bd ',
  'project manager',
  'partnerships',
  'founder',
  'founding ',
];

function pad(s: string): string {
  return ` ${s.toLowerCase()} `;
}

function hasAny(haystack: string, tokens: string[]): boolean {
  const padded = pad(haystack);
  return tokens.some((t) => padded.includes(t));
}

function classify(title: string | undefined): ETemplateId | null {
  if (!title || title.trim().length === 0) return null;
  const t = title.toLowerCase();
  if (hasAny(t, MANAGER_TOKENS)) return ETemplateId.Leader;
  if (hasAny(t, GENERALIST_TOKENS)) return ETemplateId.Generalist;
  if (hasAny(t, TECHNICAL_TOKENS)) return ETemplateId.IcTechnical;
  return null;
}

export function suggestTemplate(
  profile: IProfile,
  jobTitle: string | undefined,
): ITemplateSuggestion {
  const recentProfileTitle = profile.workHistory?.[0]?.title;
  const profileClass = classify(recentProfileTitle);
  const jobClass = classify(jobTitle);

  if (jobClass && profileClass && jobClass === profileClass) {
    return {
      id: jobClass,
      confidence: ETemplateConfidence.High,
      reason: 'Profile and job description both point to this template.',
    };
  }
  if (jobClass) {
    return {
      id: jobClass,
      confidence: ETemplateConfidence.Medium,
      reason: 'Job title suggests this template; profile is mixed.',
    };
  }
  if (profileClass) {
    return {
      id: profileClass,
      confidence: ETemplateConfidence.Medium,
      reason: 'Job title was inconclusive; following profile.',
    };
  }
  return {
    id: ETemplateId.IcTechnical,
    confidence: ETemplateConfidence.Low,
    reason: 'Could not infer from titles; defaulting to IC technical.',
  };
}
