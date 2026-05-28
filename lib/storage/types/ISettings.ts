import { z } from 'zod';

import { ELocalModelVariant } from './ELocalModelVariant';
import { EVerificationMode } from './EVerificationMode';
import { SourceConfigSchema } from './ISourceConfig';

export const SettingsSchema = z.object({
  anthropicApiKey: z.string().optional(),
  aiModel: z.string().default('claude-sonnet-4-6'),
  aiMaxTokens: z.number().int().positive().max(200_000).default(8192),
  defaultTemplateId: z.string().optional(),
  sourceConfigs: z.array(SourceConfigSchema).default([]),
  /** 0 disables periodic auto-refresh. Otherwise the polling interval in minutes. */
  autoRefreshIntervalMin: z.number().int().nonnegative().max(1440).default(0),
  /** When a job-URL import returns thin results, fall back to an AI extraction pass. */
  aiImportFallback: z.boolean().default(true),
  /** How thoroughly generated documents are fact-checked against the profile. */
  verificationMode: z
    .nativeEnum(EVerificationMode)
    .default(EVerificationMode.Thorough),
  /** Cross-check every number in generated content against the profile (zero-token). */
  crossCheckNumbers: z.boolean().default(true),
  /** Unix seconds, last successful refresh-all timestamp. */
  lastRefreshAt: z.number().int().nonnegative().optional(),
  /**
   * Stage 2 of the screening cascade: cheap embedding similarity vs profile.
   * `undefined` means the user has not been through the first-visit gate yet.
   */
  screeningEmbeddingEnabled: z.boolean().optional(),
  /**
   * Stage 3 of the screening cascade: local LLM reasoning gate in a browser
   * Web Worker. `undefined` means the user has not been through the gate yet.
   */
  screeningLocalEnabled: z.boolean().optional(),
  /** Cosine threshold for the embedding screen. Default 0.30. */
  screeningEmbeddingThreshold: z.number().min(0).max(1).default(0.3),
  /** Local model size/quality trade-off for Stage 3. Default is Stronger;
   *  most local hardware can handle it and accuracy wins. */
  screeningLocalModelVariant: z
    .nativeEnum(ELocalModelVariant)
    .default(ELocalModelVariant.Stronger),
  /** Days before re-verifying a posting is still reachable. Default 7. */
  screeningLivenessDays: z.number().int().min(1).max(90).default(7),
  /** Auto-tune the embedding threshold and batch size after every
   *  local verdict. When on, the manual threshold input goes read-only. */
  screeningAutoTuneEnabled: z.boolean().default(true),
  /** Dynamic embedding batch size. Auto-tune writes this while learning;
   *  user-controlled when auto-tune is off. */
  screeningEmbeddingBatchSize: z.number().int().min(1).max(100).default(25),
  /** Verdicts auto-tune needs before it can declare convergence and
   *  open the embedding batch to full size. */
  screeningAutoTuneMinVerdicts: z.number().int().min(10).max(10_000).default(100),
  /** Number of parallel local LLM worker instances spawned on /jobs.
   *  Each worker holds its own engine in memory; total VRAM scales
   *  roughly linearly. 1 is safest; the UI suggests a higher value
   *  based on the WebGPU adapter capability and chosen model size. */
  screeningLocalParallelism: z.number().int().min(1).max(4).default(1),
  /**
   * ISO 639-3 codes of languages the user can read. Jobs detected in
   * any other language are dropped at ingest with EScreenStage.Language
   * before they reach the embedding stage. Default ['eng']. Setting
   * this to an empty list disables the language gate entirely.
   * Changes are not retroactive; previously-rejected jobs stay
   * rejected unless explicitly re-screened.
   */
  allowedLanguages: z.array(z.string().length(3)).default(['eng']),
});

export interface ISettings extends z.infer<typeof SettingsSchema> {}
