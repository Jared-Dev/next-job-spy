import 'server-only';

import type { ZodTypeAny, z } from 'zod';

const FENCE_OPEN = /^\s*```(?:json)?\s*/;
const FENCE_CLOSE = /\s*```\s*$/;

export function parseJsonFromAgent<T extends ZodTypeAny>(
  text: string,
  schema: T,
): z.infer<T> {
  let cleaned = text.trim();
  cleaned = cleaned.replace(FENCE_OPEN, '').replace(FENCE_CLOSE, '');

  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let start = -1;
  let end = -1;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = cleaned.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    start = firstBracket;
    end = cleaned.lastIndexOf(']');
  }
  if (start !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Could not parse JSON from Claude response. Raw: ${text.slice(0, 200)}…`,
      { cause: err },
    );
  }
  return schema.parse(parsed);
}
