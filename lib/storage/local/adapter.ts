'use client';

import type { TStorageAdapter } from '@/lib/storage/types/TStorageAdapter';

import {
  clearAdminKey,
  clearApiKey,
  hasAdminKey,
  hasApiKey,
  setAdminKey,
  setApiKey,
} from './apiKey';
import { pinArtifact, saveArtifact, useArtifact, useArtifacts } from './artifacts';
import { upsertApplication, useApplications } from './applications';
import {
  updateJobFit,
  updateJobStatus,
  upsertJobs,
  useJob,
  useJobs,
} from './jobs';
import { saveProfile, useProfile } from './profile';
import { saveSettings, useSettings } from './settings';

export const localAdapter: TStorageAdapter = {
  useProfile,
  saveProfile,
  useSettings,
  saveSettings,
  hasApiKey,
  setApiKey,
  clearApiKey,
  hasAdminKey,
  setAdminKey,
  clearAdminKey,
  useJobs,
  useJob,
  upsertJobs,
  updateJobStatus,
  updateJobFit,
  useApplications,
  upsertApplication,
  useArtifacts,
  useArtifact,
  saveArtifact,
  pinArtifact,
};
