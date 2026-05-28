/**
 * Cross-OS filename sanitization for cover-letter PDFs. The same value has to
 * survive a Windows save dialog, a macOS Finder copy, and a Linux upload, so
 * the rules here are the strict intersection of all three:
 *
 *   - Printable ASCII only (0x20 to 0x7E). Anything else risks mojibake when
 *     the file moves between systems with different default encodings.
 *   - No `\ / : * ? " < > |` (Windows-forbidden) and no leading/trailing dots
 *     or spaces (Windows strips them and macOS hides dot-prefixed files).
 *   - Reserved Windows device names (CON, PRN, AUX, NUL, COM1 to COM9,
 *     LPT1 to LPT9) are rejected outright; the file simply cannot be created
 *     under those base names on Windows.
 *
 * Two entry points:
 *   - `sanitizeStem(raw)` returns the cleaned stem (without ".pdf"). Empty
 *     string when nothing survives, callers decide how to surface that.
 *   - `sanitizeForSave(raw, fallback)` returns a complete ready-to-save
 *     filename ending in ".pdf", falling back to a generic name when the
 *     input is unrecoverable. Used by the cover-letter export path.
 */

const FORBIDDEN_CHARS_RE = /[\\/:*?"<>|]/g;
const NON_ASCII_RE = /[^\x20-\x7E]/g;
const WHITESPACE_RE = /\s+/g;
const WINDOWS_RESERVED_RE = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

const DEFAULT_MAX_LENGTH = 80;

export function sanitizeStem(raw: string, maxLength = DEFAULT_MAX_LENGTH): string {
  if (!raw) return '';
  let name = raw.normalize('NFKC');
  name = name.replace(NON_ASCII_RE, '');
  name = name.replace(FORBIDDEN_CHARS_RE, '');
  name = name.replace(WHITESPACE_RE, ' ').trim();
  name = name.replace(/^\.+/, '').replace(/[. ]+$/, '');
  if (WINDOWS_RESERVED_RE.test(name)) return '';
  if (name.length > maxLength) name = name.slice(0, maxLength).trimEnd();
  return name;
}

export function sanitizeForSave(raw: string, fallback = 'Cover Letter.pdf'): string {
  const stem = sanitizeStem(raw.replace(/\.pdf$/i, ''));
  if (!stem) return fallback;
  return `${stem}.pdf`;
}
