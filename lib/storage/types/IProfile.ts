import { z } from 'zod';

import { CareerContextSchema } from './ICareerContext';
import { EducationEntrySchema } from './IEducationEntry';
import { PersonalSiteSchema } from './IPersonalSite';
import { PreferencesSchema } from './IPreferences';
import { ProfileLinkSchema } from './IProfileLink';
import { SkillSchema } from './ISkill';
import { WorkEntrySchema } from './IWorkEntry';

export const ProfileSchema = z.object({
  fullName: z.string().optional(),
  headline: z
    .string()
    .optional()
    .describe('A short professional headline, e.g. "Staff Frontend Engineer"'),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  personalSite: PersonalSiteSchema.optional(),
  links: z.array(ProfileLinkSchema).optional(),
  summary: z
    .string()
    .optional()
    .describe('2-4 sentence professional summary in the candidate voice'),
  workHistory: z.array(WorkEntrySchema).optional(),
  education: z.array(EducationEntrySchema).optional(),
  skills: z
    .array(SkillSchema)
    .optional()
    .describe('Skills with a per-skill strength rating'),
  achievements: z
    .array(z.string())
    .optional()
    .describe('Standalone awards, certifications, notable projects'),
  forFun: z
    .string()
    .optional()
    .describe(
      'One short, specific line of personal interests/hobbies — the more memorable and specific the better. Used to humanize the candidate on resumes and cover letters.',
    ),
  preferences: PreferencesSchema.optional(),
  careerContext: CareerContextSchema.optional(),
  /**
   * Skills the candidate has explicitly said they don't have, so we stop
   * prompting them about it when a job's requirements call it out. Stored
   * lowercase for case-insensitive matching.
   */
  dismissedSkills: z.array(z.string()).optional(),
  /** The raw Markdown the profile was imported from, kept for re-distillation. */
  sourceMarkdown: z.string().optional(),
});

export interface IProfile extends z.infer<typeof ProfileSchema> {}
