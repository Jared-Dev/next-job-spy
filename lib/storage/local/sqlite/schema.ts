import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
  preferences: text('preferences', { mode: 'json' }).$type<IPreferences>(),
  careerContext: text('career_context', { mode: 'json' }).$type<ICareerContext>(),
  sourceMarkdown: text('source_markdown'),
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
  templateId: text('template_id'),
  prompt: text('prompt'),
  inputHash: text('input_hash'),
  content: text('content').notNull(),
  usage: text('usage', { mode: 'json' }),
  pinned: integer('pinned', { mode: 'boolean' }),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});
