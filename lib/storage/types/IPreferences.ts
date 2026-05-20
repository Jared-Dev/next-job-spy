import { z } from 'zod';

import { ERemotePreference } from './ERemotePreference';

export const PreferencesSchema = z.object({
  desiredTitles: z.array(z.string()).optional(),
  desiredLocations: z.array(z.string()).optional(),
  remote: z.nativeEnum(ERemotePreference).optional(),
  minSalary: z.number().optional(),
  currency: z.string().optional(),
  excludeCompanies: z.array(z.string()).optional(),
});

export interface IPreferences extends z.infer<typeof PreferencesSchema> {}
