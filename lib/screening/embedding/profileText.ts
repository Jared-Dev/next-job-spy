import type { IProfile } from '@/lib/storage/types/IProfile';

/**
 * Assemble a profile into a string the embedding model can attend to.
 * Order: headline first (highest signal), then summary, then skills, then
 * a few work-history entries. Kept tight: embeddings work best with
 * focused signal, not boilerplate. We cap work history to the most
 * recent five entries so the input fits comfortably under the model's
 * context window.
 */
export function profileTextForEmbedding(profile: IProfile): string {
  const parts: string[] = [];
  if (profile.headline) parts.push(profile.headline);
  if (profile.summary) parts.push(profile.summary);

  if (profile.skills && profile.skills.length > 0) {
    parts.push('Skills: ' + profile.skills.map((s) => s.name).join(', '));
  }

  if (profile.workHistory && profile.workHistory.length > 0) {
    const top = profile.workHistory.slice(0, 5);
    parts.push(
      'Experience:\n' +
        top
          .map((w) =>
            [w.title, w.company, w.summary].filter(Boolean).join(', '),
          )
          .join('\n'),
    );
  }

  return parts.join('\n\n');
}
