import type { IResumeDocument, IResumeRole } from './types/IResumeDocument';

/**
 * Maximum detailed roles allowed in the experience section. Anything beyond
 * this is folded into the "earlier" one-liner so the rendered PDF stays inside
 * the two-page ceiling the system prompt promises.
 *
 * Four is the empirical limit before a Letter-page resume reliably overflows
 * onto page three: header + summary + ~four roles + skills + education leaves
 * just enough room for the For Fun band.
 */
const MAX_DETAILED_ROLES = 4;

/**
 * Server-side safety net. The system prompt tells the model to cap the
 * experience array at four entries; this function enforces that promise when
 * the model ignores it. Anything past index three becomes a short addition to
 * the "earlier" line — "Title at Company (dates); …" — so no work history is
 * lost, it just stops getting the full bullet treatment.
 */
export function enforceRoleCap(resume: IResumeDocument): IResumeDocument {
  if (resume.experience.length <= MAX_DETAILED_ROLES) return resume;
  const keep = resume.experience.slice(0, MAX_DETAILED_ROLES);
  const overflow = resume.experience.slice(MAX_DETAILED_ROLES);
  const overflowSummary = overflow.map(summarizeRole).join('; ');
  const trimmedExisting = (resume.earlier ?? '').trim();
  const combined = trimmedExisting
    ? `${trimmedExisting.replace(/\.\s*$/, '')}. Also ${overflowSummary}.`
    : `${overflowSummary}.`;
  return {
    ...resume,
    experience: keep,
    earlier: combined,
  };
}

function summarizeRole(role: IResumeRole): string {
  const where = role.company ? ` at ${role.company}` : '';
  const when = role.dates ? ` (${role.dates})` : '';
  return `${role.title}${where}${when}`;
}
