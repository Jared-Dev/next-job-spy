import 'server-only';

import type { IProfile } from '@/lib/storage/types/IProfile';

/**
 * Returns a profile with generation-irrelevant fields stripped. Notably drops
 * `sourceMarkdown`, the raw career document the profile was distilled from is
 * dead weight for tailoring (the structured fields already carry the signal)
 * and can run several thousand tokens. Used by every document-drafting route.
 */
export function trimProfileForGeneration(profile: IProfile): IProfile {
  const trimmed: IProfile = { ...profile };
  delete trimmed.sourceMarkdown;
  return trimmed;
}
