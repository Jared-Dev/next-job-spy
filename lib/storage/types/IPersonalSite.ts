import { z } from 'zod';

import { PersonalSiteSectionSchema } from './IPersonalSiteSection';

/**
 * The candidate's personal / portfolio site, the recruiter-facing hub that
 * lands on every resume. One URL, plus a list of what's on it (a site commonly
 * holds several things: a portfolio, a blog, case studies, an about page).
 */
export const PersonalSiteSchema = z.object({
  url: z.string(),
  sections: z.array(PersonalSiteSectionSchema).optional(),
});

export interface IPersonalSite extends z.infer<typeof PersonalSiteSchema> {}
