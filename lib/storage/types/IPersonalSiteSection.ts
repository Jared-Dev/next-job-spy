import { z } from 'zod';

/**
 * One section of a personal site, e.g. "Portfolio", "Technical blog",
 * "Case studies", "Interactive resume", "About". `description` is an optional
 * one-liner giving the resume generator context to reference it.
 */
export const PersonalSiteSectionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export interface IPersonalSiteSection
  extends z.infer<typeof PersonalSiteSectionSchema> {}
