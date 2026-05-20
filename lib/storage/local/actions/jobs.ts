'use server';

import { and, desc, eq, gte, inArray, isNull, like, or } from 'drizzle-orm';

import { db, schema } from '@/lib/storage/local/sqlite/Database';
import type { EJobStatus } from '@/lib/storage/types/EJobStatus';
import type { ESourceId } from '@/lib/storage/types/ESourceId';
import type { IJob } from '@/lib/storage/types/IJob';
import {
  UNKNOWN_COUNTRY_TOKEN,
  type IJobFilters,
} from '@/lib/storage/types/IJobFilters';

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
  };
}

export async function listJobsAction(filters?: IJobFilters): Promise<IJob[]> {
  const conditions = [];
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

export async function upsertJobsAction(
  jobs: IJob[],
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
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
      db.insert(schema.job)
        .values({
          source: job.source,
          sourceId: job.sourceId,
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
          discoveredAt: job.discoveredAt,
          fitScore: job.fitScore ?? null,
          fitNotes: job.fitNotes ?? null,
          status: job.status,
        })
        .run();
      inserted += 1;
    }
  }
  return { inserted, updated };
}

export async function createJobAction(job: IJob): Promise<number> {
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
    })
    .run();
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
  db.update(schema.job).set({ fitScore, fitNotes }).where(eq(schema.job.id, id)).run();
}
