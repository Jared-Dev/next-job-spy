import { z } from 'zod';

export const ProfileLinkSchema = z.object({
  label: z.string().describe('e.g. LinkedIn, GitHub, Portfolio'),
  url: z.string(),
});

export interface IProfileLink extends z.infer<typeof ProfileLinkSchema> {}
