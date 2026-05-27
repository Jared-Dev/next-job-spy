import { z } from 'zod';

import { EArtifactKind } from './EArtifactKind';
import { UsageStampSchema } from './IUsageStamp';

export const ArtifactSchema = z.object({
  id: z.number().int().optional(),
  jobId: z.number().int().optional(),
  applicationId: z.number().int().optional(),
  parentArtifactId: z.number().int().optional(),
  kind: z.nativeEnum(EArtifactKind),
  prompt: z.string().optional(),
  inputHash: z.string().optional(),
  content: z.string(),
  /**
   * Recommended save-as filename for the artifact. Cover letters use this for
   * the clickbait-style filename the model generates; resumes use a
   * standardized name and can leave this empty.
   */
  filename: z.string().optional(),
  usage: UsageStampSchema.optional(),
  createdAt: z.number().int(),
  pinned: z.boolean().optional(),
});

export interface IArtifact extends z.infer<typeof ArtifactSchema> {}
