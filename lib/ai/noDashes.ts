/**
 * En/em dash policy for AI-drafted documents. Generated resumes and cover
 * letters go to employers; en dashes (–) and em dashes (—) read as AI-written,
 * so every document-drafting prompt is told to avoid them and the output is
 * regex-checked afterwards. See invokeClaudeAgentForDocument.
 */

/** En dash (U+2013) and em dash (U+2014). */
const FORBIDDEN_DASHES = /[–—]/;

/** Appended to the system prompt of every document-drafting AI call. */
export const NO_DASHES_RULE = `Punctuation rule (strict, verified after generation): do not use en dashes (–) or em dashes (—) anywhere in your output. Where you would reach for one, use a comma, colon, semicolon, or parentheses, and use the word "to" for ranges (for example "2021 to 2024"). A standard hyphen (-) is allowed only inside genuine compound words such as "time-to-interactive". Output containing an en dash or em dash is rejected and regenerated.`;

/** Appended to the prompt when an output failed the check and needs redoing. */
export const NO_DASHES_REWRITE_NOTE = `REWRITE REQUIRED: your previous output contained an en dash (–) or em dash (—), which is not allowed. Produce the document again with every en dash and em dash removed, replacing each with a comma, colon, parentheses, or the word "to". Output the complete document.`;

/** True when the text contains an en dash or em dash. */
export function hasForbiddenDashes(text: string): boolean {
  return FORBIDDEN_DASHES.test(text);
}

/**
 * Deterministic last-resort cleanup, used only if the model still slips a
 * dash through after its re-write attempts, so a document is never delivered
 * with a forbidden dash.
 */
export function stripForbiddenDashes(text: string): string {
  return text.replace(/ *— */g, ', ').replace(/–/g, '-');
}
