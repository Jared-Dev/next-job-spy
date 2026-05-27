import type { IResumeDocument } from './types/IResumeDocument';

/**
 * Conservative estimate of how tall the rendered resume PDF will be, in
 * typographic points. Mirrors the style values used in
 * components/resume/pdf/ResumeDocument.tsx so the route layer can decide
 * whether the content will spill past the two-page ceiling before paying for
 * a render. Tuned to over-estimate slightly; better to ask the model to cut
 * once too often than to ship an oversized resume.
 */
export function estimateRenderHeightPt(resume: IResumeDocument): number {
  let h = 0;

  // Header (name + contact + summary + divider).
  h += 26; // name
  h += 14; // contact
  if (resume.summary) {
    h += lines(resume.summary, CHARS_PER_LINE_BODY) * 16;
  }
  h += 15; // divider margin + rule

  // Work Experience.
  h += sectionTitleBlock();
  for (const [i, role] of resume.experience.entries()) {
    h += i === 0 ? 0 : 13;
    h += 13; // company line
    h += 13; // title sub-line
    if (role.scope) h += 13 + 3;
    if (role.context) h += lines(role.context, CHARS_PER_LINE_BODY) * 13 + 3;
    for (const bullet of role.bullets) {
      h += lines(bullet, CHARS_PER_LINE_BULLET) * 14 + 4;
    }
    if (role.keyResult) h += lines(role.keyResult, CHARS_PER_LINE_SUB) * 14 + 3;
    if (role.techStack) h += lines(role.techStack, CHARS_PER_LINE_SUB) * 14 + 3;
  }
  if (resume.earlier) {
    h += lines(resume.earlier, CHARS_PER_LINE_BODY) * 14 + 12;
  }

  // Skills.
  if (resume.competencies.length > 0) {
    h += sectionTitleBlock();
    for (const comp of resume.competencies) {
      const text = `${comp.category}    ${comp.items}`;
      h += lines(text, CHARS_PER_LINE_BODY) * 14 + 4;
    }
  }

  // Projects.
  if (resume.projects && resume.projects.length > 0) {
    h += sectionTitleBlock();
    for (const project of resume.projects) {
      const text = `${project.title}: ${project.detail}`;
      h += lines(text, CHARS_PER_LINE_BODY) * 14 + 5;
    }
  }

  // Education.
  if (resume.education.length > 0) {
    h += sectionTitleBlock();
    for (const edu of resume.education) {
      h += 14;
      const notesText = composeEduNotes(edu.gpa, edu.gpaScale, edu.notes);
      if (notesText) h += lines(notesText, CHARS_PER_LINE_SUB) * 13 + 2;
    }
  }

  // Speaking.
  if (resume.speaking && resume.speaking.length > 0) {
    h += sectionTitleBlock();
    for (const talk of resume.speaking) {
      const text = `${talk.title}, ${talk.detail}`;
      h += lines(text, CHARS_PER_LINE_BODY) * 14 + 5;
    }
  }

  // For Fun.
  if (resume.forFun) {
    h += sectionTitleBlock();
    h += lines(resume.forFun, CHARS_PER_LINE_BODY) * 14;
  }

  return Math.round(h);
}

/**
 * Total pt of usable content for a two-page Letter resume. We aim under this
 * budget; if the estimate exceeds it the route asks the model to trim.
 */
export const TWO_PAGE_BUDGET_PT = 1330;

function lines(text: string | undefined, perLine: number): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.trim().length / perLine));
}

function sectionTitleBlock(): number {
  // section marginTop (16) + title rendered height + marginBottom + rule.
  return 16 + 22;
}

function composeEduNotes(
  gpa: string | undefined,
  gpaScale: string | undefined,
  notes: string | undefined,
): string {
  const parts: string[] = [];
  if (gpa) parts.push(gpaScale ? `GPA ${gpa}/${gpaScale}` : `GPA ${gpa}`);
  if (notes) parts.push(notes);
  return parts.join(' · ');
}

// Empirical wrap widths at the styles used in ResumeDocument. Slightly
// conservative so 2-line bullets are estimated correctly.
const CHARS_PER_LINE_BODY = 95;
const CHARS_PER_LINE_BULLET = 80;
const CHARS_PER_LINE_SUB = 78;
