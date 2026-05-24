import type {
  ILocalScreenJob,
  ILocalScreenProfileSnapshot,
} from './types';

/**
 * The local stage is a coarse gate; it should err on the side of
 * passing borderline cases, but be aggressive about catching
 * obvious-on-second-glance mismatches that a generic "wrong field"
 * heuristic misses (intern roles for senior candidates, manager
 * roles for IC-only candidates, locations the user has explicitly
 * ruled out).
 *
 * Keep the prompt tight enough for a small model (~1B-3B param
 * range), but give it a structured reject list to check rather than
 * a vague "is this a mismatch?" question.
 */
export function buildSystemPrompt(profile: ILocalScreenProfileSnapshot): string {
  const profileLines: string[] = [];
  if (profile.headline) profileLines.push(`Current role: ${profile.headline}`);
  if (profile.summary) profileLines.push(`Summary: ${profile.summary}`);
  if (profile.skills && profile.skills.length > 0) {
    profileLines.push(`Skills: ${profile.skills.join(', ')}`);
  }
  if (profile.lookingFor) {
    profileLines.push(`LOOKING FOR: ${profile.lookingFor}`);
  }
  if (profile.avoiding) {
    profileLines.push(`AVOIDING: ${profile.avoiding}`);
  }
  if (profile.goals) profileLines.push(`Goals: ${profile.goals}`);
  if (profile.preferences) profileLines.push(`Preferences: ${profile.preferences}`);

  return [
    'You filter job postings for one user. Reject obvious mismatches.',
    '',
    'REJECT when ANY of these apply:',
    '- Wrong field (a nursing job for a software engineer, etc).',
    '- Missing required credential (active RN license, security clearance, bar admission, etc).',
    '- Intern, entry-level, junior, apprentice, or new-grad role when the candidate is mid-level or above.',
    '- Role demanding far more experience than the candidate has.',
    "- Anything matching the candidate's AVOIDING list above (apply it literally).",
    '- Wrong location, or on-site requirement when the candidate needs remote.',
    '- Manager / people-leader role when the candidate wants IC work.',
    '- IC role when the candidate wants manager / people-leader work.',
    '- Contract / temp / commission-only when the candidate wants permanent.',
    '- Permanent role when the candidate explicitly wants contract / freelance.',
    '',
    'Otherwise: pass.',
    '',
    'USER PROFILE:',
    profileLines.join('\n'),
    '',
    'Reply with strict JSON only, no preamble. Schema:',
    '{"verdict": "pass" | "reject", "reason": "<one short sentence naming the specific reason>"}',
    'No punctuation other than what the JSON requires.',
  ].join('\n');
}

const JOB_DESC_CAP = 3500;

export function buildJobPrompt(job: ILocalScreenJob): string {
  const parts: string[] = [`Title: ${job.title}`, `Company: ${job.company}`];
  if (job.location) parts.push(`Location: ${job.location}`);
  if (job.descriptionMd) {
    const desc =
      job.descriptionMd.length > JOB_DESC_CAP
        ? job.descriptionMd.slice(0, JOB_DESC_CAP)
        : job.descriptionMd;
    parts.push('', 'Description:', desc);
  }
  return parts.join('\n');
}
