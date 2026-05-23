import { ETemplateId } from '@/lib/storage/types/ETemplateId';
import type { IProfile } from '@/lib/storage/types/IProfile';

const MANAGER_TOKENS = [
  'manager',
  'director',
  'head of',
  'chief',
  'vp ',
  'vice president',
  ' lead',
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

/** Stable default order; also the tie-break when nothing distinguishes templates. */
const TEMPLATE_ORDER: ETemplateId[] = [
  ETemplateId.IcTechnical,
  ETemplateId.Leader,
  ETemplateId.Generalist,
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

/**
 * Ranks every resume template by fit for a job + profile, best first. A
 * template scores for matching the job title (weighted highest) and the
 * candidate's most recent title; ties keep the stable default order. The first
 * entry is the recommended template.
 */
export function rankTemplates(
  profile: IProfile,
  jobTitle: string | undefined,
): ETemplateId[] {
  const jobClass = classify(jobTitle);
  const profileClass = classify(profile.workHistory?.[0]?.title);

  const score = (id: ETemplateId): number =>
    (jobClass === id ? 2 : 0) + (profileClass === id ? 1 : 0);

  return [...TEMPLATE_ORDER].sort((a, b) => score(b) - score(a));
}
