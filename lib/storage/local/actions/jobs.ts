'use server';

import { and, desc, eq, gte, inArray, isNull, like, notInArray, or } from 'drizzle-orm';

import { detectJobLanguage, languageDisplayName } from '@/lib/jobs/detectLanguage';
import { db, schema } from '@/lib/storage/local/sqlite/Database';
import type { EJobStatus } from '@/lib/storage/types/EJobStatus';
import { EPipelineStatus } from '@/lib/storage/types/EPipelineStatus';
import { EScreenStage } from '@/lib/storage/types/EScreenStage';
import type { ESourceId } from '@/lib/storage/types/ESourceId';
import type { IJob } from '@/lib/storage/types/IJob';
import {
  UNKNOWN_COUNTRY_TOKEN,
  UNKNOWN_LANGUAGE_TOKEN,
  type IJobFilters,
} from '@/lib/storage/types/IJobFilters';

import {
  getInitialPipelineStatusAction,
  kickEmbeddingDrainAction,
} from './screening';
import { getSettingsAction } from './settings';

function rowToJob(row: typeof schema.job.$inferSelect): IJob {
  return {
    id: row.id,
    source: row.source as ESourceId,
    sourceId: row.sourceId,
    url: row.url,
    title: row.title,
    company: row.company,
    location: row.location ?? undefined,
    country: row.country ?? undefined,
    language: row.language ?? undefined,
    remote: row.remote ?? undefined,
    salaryMin: row.salaryMin ?? undefined,
    salaryMax: row.salaryMax ?? undefined,
    salaryCurrency: row.salaryCurrency ?? undefined,
    postedAt: row.postedAt ?? undefined,
    descriptionMd: row.descriptionMd ?? undefined,
    raw: row.raw ?? undefined,
    discoveredAt: row.discoveredAt,
    fitScore: row.fitScore ?? undefined,
    fitNotes: row.fitNotes ?? undefined,
    status: row.status as EJobStatus,
    embeddingScore: row.embeddingScore ?? undefined,
    pipelineStatus: (row.pipelineStatus as EPipelineStatus) ?? EPipelineStatus.Scraped,
    screenedOutBy: (row.screenedOutBy as EScreenStage | null) ?? undefined,
    screenReason: row.screenReason ?? undefined,
    priorityBumpedAt: row.priorityBumpedAt ?? undefined,
    livenessCheckedAt: row.livenessCheckedAt ?? undefined,
  };
}

export async function listJobsAction(filters?: IJobFilters): Promise<IJob[]> {
  const conditions = [];
  // Hide cascade-dropped jobs from the default view; the audit UI flips
  // `includeScreened` to sample them.
  if (!filters?.includeScreened) {
    conditions.push(
      notInArray(schema.job.pipelineStatus, [
        EPipelineStatus.ScreenedOut,
        EPipelineStatus.Expired,
      ]),
    );
  }
  if (filters?.status && filters.status.length > 0) {
    conditions.push(inArray(schema.job.status, filters.status));
  }
  if (filters?.sources && filters.sources.length > 0) {
    conditions.push(inArray(schema.job.source, filters.sources));
  }
  if (filters?.remoteOnly) {
    conditions.push(eq(schema.job.remote, true));
  }
  if (filters?.countries && filters.countries.length > 0) {
    const codes = filters.countries.filter((c) => c !== UNKNOWN_COUNTRY_TOKEN);
    const includeUnknown = filters.countries.includes(UNKNOWN_COUNTRY_TOKEN);
    const countryClauses = [];
    if (codes.length > 0) countryClauses.push(inArray(schema.job.country, codes));
    if (includeUnknown) countryClauses.push(isNull(schema.job.country));
    if (countryClauses.length > 0) {
      conditions.push(
        countryClauses.length === 1 ? countryClauses[0] : or(...countryClauses)!,
      );
    }
  }
  if (filters?.languages && filters.languages.length > 0) {
    const codes = filters.languages.filter((l) => l !== UNKNOWN_LANGUAGE_TOKEN);
    const includeUnknown = filters.languages.includes(UNKNOWN_LANGUAGE_TOKEN);
    const langClauses = [];
    if (codes.length > 0) langClauses.push(inArray(schema.job.language, codes));
    if (includeUnknown) langClauses.push(isNull(schema.job.language));
    if (langClauses.length > 0) {
      conditions.push(
        langClauses.length === 1 ? langClauses[0] : or(...langClauses)!,
      );
    }
  }
  if (typeof filters?.minFitScore === 'number') {
    conditions.push(gte(schema.job.fitScore, filters.minFitScore));
  }
  if (filters?.search) {
    const needle = `%${filters.search}%`;
    conditions.push(
      or(
        like(schema.job.title, needle),
        like(schema.job.company, needle),
        like(schema.job.location, needle),
      )!,
    );
  }
  const rows = await db
    .select()
    .from(schema.job)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.job.discoveredAt))
    .all();
  return rows.map(rowToJob);
}

export async function getJobAction(id: number): Promise<IJob | null> {
  const row = db.select().from(schema.job).where(eq(schema.job.id, id)).get();
  return row ? rowToJob(row) : null;
}

interface ILanguageScreen {
  language: string | null;
  pipelineStatus: EPipelineStatus;
  screenedOutBy: EScreenStage | null;
  screenReason: string | null;
}

/**
 * Decide the initial pipeline state for a freshly-ingested job in light
 * of the user's language allowlist. Detects language from the posting
 * text; if a confident detection lands outside the allowlist we drop
 * the job at the Language stage before paying for embedding or local.
 * An inconclusive detection (too little text) passes through to the
 * normal cascade.
 */
function screenLanguageForInsert(
  job: IJob,
  allowedLanguages: string[] | undefined,
  defaultStatus: EPipelineStatus,
): ILanguageScreen {
  const detected = detectJobLanguage({
    title: job.title,
    company: job.company,
    descriptionMd: job.descriptionMd,
  });
  if (detected === undefined) {
    return {
      language: null,
      pipelineStatus: defaultStatus,
      screenedOutBy: null,
      screenReason: null,
    };
  }
  const allowed = allowedLanguages ?? ['eng'];
  if (allowed.length === 0 || allowed.includes(detected)) {
    return {
      language: detected,
      pipelineStatus: defaultStatus,
      screenedOutBy: null,
      screenReason: null,
    };
  }
  return {
    language: detected,
    pipelineStatus: EPipelineStatus.ScreenedOut,
    screenedOutBy: EScreenStage.Language,
    screenReason: `Posting language ${languageDisplayName(detected)} not in your allowed languages`,
  };
}

export async function upsertJobsAction(
  jobs: IJob[],
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  const initialStatus = await getInitialPipelineStatusAction();
  const settings = await getSettingsAction();
  const allowedLanguages = settings.allowedLanguages;
  for (const job of jobs) {
    const existing = db
      .select()
      .from(schema.job)
      .where(
        and(eq(schema.job.source, job.source), eq(schema.job.sourceId, job.sourceId)),
      )
      .get();
    if (existing) {
      db.update(schema.job)
        .set({
          url: job.url,
          title: job.title,
          company: job.company,
          location: job.location ?? null,
          country: job.country ?? null,
          remote: job.remote ?? null,
          salaryMin: job.salaryMin ?? null,
          salaryMax: job.salaryMax ?? null,
          salaryCurrency: job.salaryCurrency ?? null,
          postedAt: job.postedAt ?? null,
          descriptionMd: job.descriptionMd ?? null,
          raw: job.raw ?? null,
        })
        .where(eq(schema.job.id, existing.id))
        .run();
      updated += 1;
    } else {
      const langScreen = screenLanguageForInsert(job, allowedLanguages, initialStatus);
      db.insert(schema.job)
        .values({
          source: job.source,
          sourceId: job.sourceId,
          url: job.url,
          title: job.title,
          company: job.company,
          location: job.location ?? null,
          country: job.country ?? null,
          language: langScreen.language,
          remote: job.remote ?? null,
          salaryMin: job.salaryMin ?? null,
          salaryMax: job.salaryMax ?? null,
          salaryCurrency: job.salaryCurrency ?? null,
          postedAt: job.postedAt ?? null,
          descriptionMd: job.descriptionMd ?? null,
          raw: job.raw ?? null,
          discoveredAt: job.discoveredAt,
          fitScore: job.fitScore ?? null,
          fitNotes: job.fitNotes ?? null,
          status: job.status,
          pipelineStatus: langScreen.pipelineStatus,
          screenedOutBy: langScreen.screenedOutBy,
          screenReason: langScreen.screenReason,
        })
        .run();
      inserted += 1;
    }
  }
  // Kick the embedding drain (fire-and-forget) so ingest stays responsive.
  // The drain itself respects the toggle (no-op when embedding is disabled).
  if (inserted > 0) {
    void kickEmbeddingDrainAction();
  }
  return { inserted, updated };
}

export async function createJobAction(job: IJob): Promise<number> {
  const initialStatus = await getInitialPipelineStatusAction();
  const settings = await getSettingsAction();
  const langScreen = screenLanguageForInsert(
    job,
    settings.allowedLanguages,
    initialStatus,
  );
  const result = db
    .insert(schema.job)
    .values({
      source: job.source,
      sourceId: job.sourceId,
      url: job.url,
      title: job.title,
      company: job.company,
      location: job.location ?? null,
      country: job.country ?? null,
      language: langScreen.language,
      remote: job.remote ?? null,
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      salaryCurrency: job.salaryCurrency ?? null,
      postedAt: job.postedAt ?? null,
      descriptionMd: job.descriptionMd ?? null,
      raw: job.raw ?? null,
      discoveredAt: job.discoveredAt,
      fitScore: job.fitScore ?? null,
      fitNotes: job.fitNotes ?? null,
      status: job.status,
      pipelineStatus: langScreen.pipelineStatus,
      screenedOutBy: langScreen.screenedOutBy,
      screenReason: langScreen.screenReason,
    })
    .run();
  // Kick the embedding drain (fire-and-forget). Single-job create still
  // benefits from the screen running before the user opens the job.
  void kickEmbeddingDrainAction();
  return Number(result.lastInsertRowid);
}

export async function updateJobStatusAction(
  id: number,
  status: EJobStatus,
): Promise<void> {
  db.update(schema.job).set({ status }).where(eq(schema.job.id, id)).run();
}

export async function updateJobFitAction(
  id: number,
  fitScore: number,
  fitNotes: string,
): Promise<void> {
  // Scoring is the final cascade stage; recording a score advances the
  // pipeline to Scored regardless of where the job was. This also lets
  // a manual Score-now override mark the job done in one shot.
  db.update(schema.job)
    .set({ fitScore, fitNotes, pipelineStatus: EPipelineStatus.Scored })
    .where(eq(schema.job.id, id))
    .run();
}
