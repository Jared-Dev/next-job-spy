import { z } from 'zod';

import { ESourceId } from './ESourceId';

export const SourceConfigSchema = z.object({
  id: z.string(),
  sourceId: z.nativeEnum(ESourceId),
  label: z.string().optional(),
  enabled: z.boolean().default(true),
  params: z.record(z.string(), z.string()),
});

export interface ISourceConfig extends z.infer<typeof SourceConfigSchema> {}
