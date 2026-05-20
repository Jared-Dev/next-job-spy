import type { IProfile } from '@/lib/storage/types/IProfile';

/**
 * Heuristic for "is there enough profile here to produce a useful AI ranking?"
 * The threshold is intentionally low — we want ranking to unlock quickly,
 * just not against a blank slate.
 */
export function isProfileMeaningful(profile: IProfile | undefined): boolean {
  if (!profile) return false;
  const hasWork = (profile.workHistory?.length ?? 0) >= 1;
  const hasSkills = (profile.skills?.length ?? 0) >= 3;
  const hasSummary = (profile.summary?.trim().length ?? 0) >= 40;
  // Require any one substantive signal.
  return hasWork || hasSkills || hasSummary;
}
