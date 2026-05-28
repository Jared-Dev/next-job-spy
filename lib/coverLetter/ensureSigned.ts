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

const SIGNATURE_TAIL_CHARS = 250;

function nameTokens(candidateName: string): string[] {
  return candidateName
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z'-]/g, ''))
    .filter((t) => t.length >= 2);
}

export function ensureSigned(markdown: string, candidateName: string): string {
  const name = candidateName.trim();
  if (!name) return markdown;

  const body = markdown.replace(/\s+$/u, '');
  if (body.length === 0) return body;

  const tokens = nameTokens(name);
  if (tokens.length === 0) return body;

  const tail = body.slice(-SIGNATURE_TAIL_CHARS).toLowerCase();
  const signed = tokens.every((t) => tail.includes(t));
  if (signed) return body;

  return `${body}\n\n${name}`;
}
