import { franc } from 'franc-min';

/**
 * Below this many characters the detector's signal-to-noise is too
 * poor to trust. franc itself recommends ~100 chars minimum; we go a
 * little higher because job-posting boilerplate ("Apply now", "About us")
 * is similar across languages.
 */
const MIN_DETECT_CHARS = 150;

interface IDetectInput {
  title?: string | null;
  company?: string | null;
  descriptionMd?: string | null;
}

/**
 * Returns the ISO 639-3 language code (e.g. 'eng', 'spa', 'fra') of
 * the posting, or `undefined` when there isn't enough text to decide.
 * Used at ingest to tag the job and gate the language allowlist.
 *
 * franc returns 'und' (undefined) for short or non-text input; we
 * normalise that to undefined so callers can treat "unknown" as a
 * single case.
 */
export function detectJobLanguage(input: IDetectInput): string | undefined {
  const parts = [input.title, input.company, input.descriptionMd]
    .filter((p): p is string => typeof p === 'string' && p.length > 0);
  const text = parts.join('\n').trim();
  if (text.length < MIN_DETECT_CHARS) return undefined;
  const code = franc(text);
  if (code === 'und' || code === '' || code.length !== 3) return undefined;
  return code;
}

/**
 * Display name for a 3-letter ISO 639-3 code. franc-min only knows the
 * codes, not the names; we keep a small map for languages we'd plausibly
 * encounter in job postings. Falls back to the raw code for anything
 * not in the map so the UI never shows a blank label.
 */
const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  eng: 'English',
  spa: 'Spanish',
  fra: 'French',
  deu: 'German',
  por: 'Portuguese',
  ita: 'Italian',
  nld: 'Dutch',
  swe: 'Swedish',
  nor: 'Norwegian',
  dan: 'Danish',
  fin: 'Finnish',
  pol: 'Polish',
  ces: 'Czech',
  ron: 'Romanian',
  hun: 'Hungarian',
  ell: 'Greek',
  tur: 'Turkish',
  rus: 'Russian',
  ukr: 'Ukrainian',
  arb: 'Arabic',
  heb: 'Hebrew',
  hin: 'Hindi',
  ben: 'Bengali',
  tam: 'Tamil',
  tha: 'Thai',
  vie: 'Vietnamese',
  ind: 'Indonesian',
  zsm: 'Malay',
  cmn: 'Mandarin',
  yue: 'Cantonese',
  jpn: 'Japanese',
  kor: 'Korean',
};

export function languageDisplayName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

/** Languages we surface in the Settings allowlist UI by default. */
export const COMMON_LANGUAGE_OPTIONS: ReadonlyArray<{ value: string; label: string }> =
  Object.entries(LANGUAGE_NAMES).map(([value, label]) => ({ value, label }));
