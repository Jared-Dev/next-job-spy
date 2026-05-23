import { z } from 'zod';

/**
 * Shape of a render-ready resume — what a template renders and what the PDF is
 * generated from. This is the *derived* document, not the canonical profile:
 * resume generation produces one of these from profile + job. The Zod schema
 * is the single source of truth; it validates AI-generated output before it is
 * stored or rendered.
 */

export const ResumeContactSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  site: z.string().optional(),
});

/** One position in the experience section. */
export const ResumeRoleSchema = z.object({
  title: z.string(),
  company: z.string(),
  /** One-line scale/context note shown after the company name. */
  context: z.string().default(''),
  /** Leadership-scope strip — team size, budget, reporting line. Leader only. */
  scope: z.string().optional(),
  /** Human-readable date range, e.g. "2021 to Present". */
  dates: z.string().default(''),
  bullets: z.array(z.string()).default([]),
});

/** A labelled keyword cluster in the competencies band. */
export const ResumeCompetencySchema = z.object({
  category: z.string(),
  items: z.string(),
});

/** A title + detail line — used for projects and speaking/writing. */
export const ResumeEntrySchema = z.object({
  title: z.string(),
  detail: z.string(),
});

export const ResumeEducationSchema = z.object({
  degree: z.string(),
  institution: z.string(),
  year: z.string().default(''),
});

export const ResumeDocumentSchema = z.object({
  name: z.string(),
  headline: z.string().default(''),
  contact: ResumeContactSchema.default({}),
  summary: z.string().default(''),
  competencies: z.array(ResumeCompetencySchema).default([]),
  experience: z.array(ResumeRoleSchema).default([]),
  /** Compressed pre-history — older roles collapsed to a single line. */
  earlier: z.string().optional(),
  projects: z.array(ResumeEntrySchema).optional(),
  education: z.array(ResumeEducationSchema).default([]),
  speaking: z.array(ResumeEntrySchema).optional(),
});

export interface IResumeContact extends z.infer<typeof ResumeContactSchema> {}
export interface IResumeRole extends z.infer<typeof ResumeRoleSchema> {}
export interface IResumeCompetency
  extends z.infer<typeof ResumeCompetencySchema> {}
export interface IResumeEntry extends z.infer<typeof ResumeEntrySchema> {}
export interface IResumeEducation
  extends z.infer<typeof ResumeEducationSchema> {}
export interface IResumeDocument
  extends z.infer<typeof ResumeDocumentSchema> {}
