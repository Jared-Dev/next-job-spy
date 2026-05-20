import type { IArtifact } from '@/lib/storage/types/IArtifact';

export interface IArtifactStampProps {
  artifact: IArtifact;
  compact?: boolean;
}
