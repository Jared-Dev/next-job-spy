import { z } from 'zod';

import { EArtifactKind } from './EArtifactKind';
import { UsageStampSchema } from './IUsageStamp';

export const ArtifactSchema = z.object({
  id: z.number().int().optional(),
  jobId: z.number().int().optional(),
  applicationId: z.number().int().optional(),
  parentArtifactId: z.number().int().optional(),
  kind: z.nativeEnum(EArtifactKind),
  templateId: z.string().optional(),
  prompt: z.string().optional(),
  inputHash: z.string().optional(),
  content: z.string(),
  usage: UsageStampSchema.optional(),
  createdAt: z.number().int(),
  pinned: z.boolean().optional(),
});

export interface IArtifact extends z.infer<typeof ArtifactSchema> {}
