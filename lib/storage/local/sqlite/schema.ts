import { sql } from 'drizzle-orm';
import { blob, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { ICvInterviewMessage } from '@/lib/cv/types/ICvInterviewMessage';
import type { ICvStory } from '@/lib/cv/types/ICvStory';
import type { ICareerContext } from '@/lib/storage/types/ICareerContext';
import type { IEducationEntry } from '@/lib/storage/types/IEducationEntry';
import type { IPersonalSite } from '@/lib/storage/types/IPersonalSite';
import type { IPreferences } from '@/lib/storage/types/IPreferences';
import type { IProfileLink } from '@/lib/storage/types/IProfileLink';
import type { ISkill } from '@/lib/storage/types/ISkill';
import type { IWorkEntry } from '@/lib/storage/types/IWorkEntry';

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
});

export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(),
  fullName: text('full_name'),
  headline: text('headline'),
  email: text('email'),
  phone: text('phone'),
  location: text('location'),
  personalSite: text('personal_site', { mode: 'json' }).$type<IPersonalSite>(),
  links: text('links', { mode: 'json' }).$type<IProfileLink[]>(),
  summary: text('summary'),
  workHistory: text('work_history', { mode: 'json' }).$type<IWorkEntry[]>(),
  education: text('education', { mode: 'json' }).$type<IEducationEntry[]>(),
  skills: text('skills', { mode: 'json' }).$type<ISkill[]>(),
  achievements: text('achievements', { mode: 'json' }).$type<string[]>(),
  forFun: text('for_fun'),
  /** Skills the candidate told us they don't have, stored lowercased so we stop asking. */
  dismissedSkills: text('dismissed_skills', { mode: 'json' }).$type<string[]>(),
  /** Saved cover-letter stories the candidate can pick from per job. */
  cvStories: text('cv_stories', { mode: 'json' }).$type<ICvStory[]>(),
  /** Running CV interview chat transcript, resumable across sessions. */
  cvInterviewTranscript: text('cv_interview_transcript', { mode: 'json' }).$type<
    ICvInterviewMessage[]
  >(),
  preferences: text('preferences', { mode: 'json' }).$type<IPreferences>(),
  careerContext: text('career_context', { mode: 'json' }).$type<ICareerContext>(),
  sourceMarkdown: text('source_markdown'),
  /** Float32 embedding vector bytes for the screening cascade. See lib/screening/embedding. */
  embedding: blob('embedding'),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
});

export const job = sqliteTable('job', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  source: text('source').notNull(),
  sourceId: text('source_id').notNull(),
  url: text('url').notNull(),
  title: text('title').notNull(),
  company: text('company').notNull(),
  location: text('location'),
  country: text('country'),
  /** ISO 639-3 language code detected from the posting text at ingest.
   * `null` when detection was inconclusive (e.g., too little text). */
  language: text('language'),
  remote: integer('remote', { mode: 'boolean' }),
  salaryMin: integer('salary_min'),
  salaryMax: integer('salary_max'),
  salaryCurrency: text('salary_currency'),
  postedAt: integer('posted_at'),
  descriptionMd: text('description_md'),
  raw: text('raw', { mode: 'json' }),
  discoveredAt: integer('discovered_at').notNull().default(sql`(unixepoch())`),
  fitScore: real('fit_score'),
  fitNotes: text('fit_notes'),
  status: text('status').notNull().default('new'),
  // Screening cascade. See EPipelineStatus / EScreenStage.
  // `embedding` is the raw Float32 vector bytes; held server-side only.
  embedding: blob('embedding'),
  embeddingScore: real('embedding_score'),
  pipelineStatus: text('pipeline_status').notNull().default('scraped'),
  screenedOutBy: text('screened_out_by'),
  screenReason: text('screen_reason'),
  priorityBumpedAt: integer('priority_bumped_at'),
  livenessCheckedAt: integer('liveness_checked_at'),
  /** Set by applyLocalVerdictAction on both pass and reject. Used to
   *  distinguish "local screen ran and passed" (LocalDone with this
   *  set) from "embedding stage bypassed because local was off"
   *  (LocalDone with this null). */
  localJudgedAt: integer('local_judged_at'),
  /** Skills/tools/keywords extracted from the job description for the
   * missing-skills prompt. Cached so we don't re-extract on every open. */
  desiredSkills: text('desired_skills', { mode: 'json' }).$type<string[]>(),
  /** Candidate marked this posting as not accepting cover letters. */
  noCoverLetter: integer('no_cover_letter', { mode: 'boolean' }),
  /** Cached per-job ranking of the candidate's cv stories. JSON blob keyed by hash. */
  storyRanking: text('story_ranking', { mode: 'json' }).$type<{
    hash: string;
    items: { storyId: string; why: string }[];
    rankedAt: number;
  }>(),
});

export const screeningAudit = sqliteTable('screening_audit', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('job_id')
    .notNull()
    .references(() => job.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull(),
  verdict: text('verdict').notNull(),
  reviewedAt: integer('reviewed_at').notNull().default(sql`(unixepoch())`),
});

export const application = sqliteTable('application', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('job_id')
    .notNull()
    .references(() => job.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('drafting'),
  submittedAt: integer('submitted_at'),
  notes: text('notes'),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
});

export const artifact = sqliteTable('artifact', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('job_id').references(() => job.id, { onDelete: 'cascade' }),
  applicationId: integer('application_id').references(() => application.id, {
    onDelete: 'cascade',
  }),
  parentArtifactId: integer('parent_artifact_id'),
  kind: text('kind').notNull(),
  prompt: text('prompt'),
  inputHash: text('input_hash'),
  content: text('content').notNull(),
  /** Recommended save-as filename (cover letters use the model's clickbait name). */
  filename: text('filename'),
  /** Source story id for story-mode cover letters; null otherwise. */
  storyId: text('story_id'),
  usage: text('usage', { mode: 'json' }),
  pinned: integer('pinned', { mode: 'boolean' }),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});
