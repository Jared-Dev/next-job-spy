import type { IApplication } from './IApplication';
import type { IArtifact } from './IArtifact';
import type { IJob } from './IJob';
import type { IJobFilters } from './IJobFilters';
import type { IProfile } from './IProfile';
import type { ISettings } from './ISettings';

export type TStorageAdapter = {
  // Profile
  useProfile: () => IProfile | undefined;
  saveProfile: (profile: IProfile) => Promise<void>;

  // Settings (everything except the API key, which is the cookie in hosted and a separate entry in local)
  useSettings: () => ISettings | undefined;
  saveSettings: (settings: Partial<ISettings>) => Promise<void>;

  // Inference API key — hosted writes HttpOnly cookie via /api/key, local writes settings row
  hasApiKey: () => Promise<boolean>;
  setApiKey: (key: string) => Promise<void>;
  clearApiKey: () => Promise<void>;

  // Optional Anthropic Admin API key — used only to query billing/usage (read-only)
  hasAdminKey: () => Promise<boolean>;
  setAdminKey: (key: string) => Promise<void>;
  clearAdminKey: () => Promise<void>;

  // Jobs (Phase 2)
  useJobs: (filters?: IJobFilters) => IJob[] | undefined;
  useJob: (id: number) => IJob | undefined;
  upsertJobs: (jobs: IJob[]) => Promise<{ inserted: number; updated: number }>;
  createJob: (job: IJob) => Promise<number>;
  updateJobStatus: (id: number, status: IJob['status']) => Promise<void>;
  updateJobFit: (id: number, fitScore: number, fitNotes: string) => Promise<void>;

  // Applications (Phase 2/3)
  useApplications: () => IApplication[] | undefined;
  upsertApplication: (app: IApplication) => Promise<number>;

  // Artifacts (Phase 3)
  useArtifacts: (jobId?: number) => IArtifact[] | undefined;
  useArtifact: (id: number) => IArtifact | undefined;
  saveArtifact: (artifact: IArtifact) => Promise<number>;
  pinArtifact: (id: number, pinned: boolean) => Promise<void>;
};
