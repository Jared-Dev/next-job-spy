/**
 * Guarantee a cover-letter body ends with the candidate's signature. Detects
 * the common cases where the model already signed off (with or without a
 * "Sincerely" / "Best" prefix) and only appends a fresh signature line when
 * the letter genuinely cuts off with no name.
 *
 * Used by:
 *   - the CoverLetterDocument PDF renderer (so previews of unsigned stories
 *     get a proper closing block before they're rendered)
 *   - the /api/ai/cover-letter route (so the artifact text itself is signed,
 *     not just the rendered file, which keeps clipboard copy honest)
 */

const SIGNATURE_BLOCK_MAX_CHARS = 100;
const SIGNATURE_BLOCK_MAX_LINES = 3;

function nameTokens(candidateName: string): string[] {
  return candidateName
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z'-]/g, ''))
    .filter((t) => t.length >= 2);
}

/**
 * Whether the body already ends with a sign-off line containing every name
 * token. Walks back through up to a few non-empty tail lines and treats
 * them as the closing block; a real signature is a short tail that
 * contains the candidate's name.
 *
 * Why not the older approach of substring-searching a 250-char fixed
 * tail? Story-mode letters often weave the candidate's name into the
 * narrative ("my dad called me Jared the Malcolm boy"), and the older
 * check read both tokens as a sign-off, then quietly no-op'd. The
 * resulting PDF shipped without a signature. Constraining the search to
 * a short tail block (and stopping as soon as the block stops being
 * short) rules that false positive out.
 */
function isSignedTail(body: string, tokens: string[]): boolean {
  const lines = body
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return false;
  for (
    let take = 1;
    take <= SIGNATURE_BLOCK_MAX_LINES && take <= lines.length;
    take += 1
  ) {
    const block = lines.slice(-take).join(' ').toLowerCase();
    if (block.length > SIGNATURE_BLOCK_MAX_CHARS) break;
    if (tokens.every((t) => block.includes(t))) return true;
  }
  return false;
}

export function ensureSigned(markdown: string, candidateName: string): string {
  const name = candidateName.trim();
  if (!name) return markdown;

  const body = markdown.replace(/\s+$/u, '');
  if (body.length === 0) return body;

  const tokens = nameTokens(name);
  if (tokens.length === 0) return body;

  if (isSignedTail(body, tokens)) return body;
  return `${body}\n\n${name}`;
}
