'use server';

import { desc, eq } from 'drizzle-orm';

import { ensureSigned } from '@/lib/coverLetter/ensureSigned';
import { db, schema } from '@/lib/storage/local/sqlite/Database';
import { EArtifactKind } from '@/lib/storage/types/EArtifactKind';
import type { IArtifact } from '@/lib/storage/types/IArtifact';
import type { IUsageStamp } from '@/lib/storage/types/IUsageStamp';

function rowToArtifact(row: typeof schema.artifact.$inferSelect): IArtifact {
  return {
    id: row.id,
    jobId: row.jobId ?? undefined,
    applicationId: row.applicationId ?? undefined,
    parentArtifactId: row.parentArtifactId ?? undefined,
    kind: row.kind as EArtifactKind,
    prompt: row.prompt ?? undefined,
    inputHash: row.inputHash ?? undefined,
    content: row.content,
    filename: row.filename ?? undefined,
    storyId: row.storyId ?? undefined,
    usage: (row.usage as IUsageStamp | null) ?? undefined,
    createdAt: row.createdAt,
    pinned: row.pinned ?? undefined,
  };
}

export async function listArtifactsAction(jobId?: number): Promise<IArtifact[]> {
  const query = db.select().from(schema.artifact).orderBy(desc(schema.artifact.createdAt));
  const rows =
    typeof jobId === 'number'
      ? await query.where(eq(schema.artifact.jobId, jobId)).all()
      : await query.all();
  return rows.map(rowToArtifact);
}

export async function getArtifactAction(id: number): Promise<IArtifact | null> {
  const row = db.select().from(schema.artifact).where(eq(schema.artifact.id, id)).get();
  return row ? rowToArtifact(row) : null;
}

export async function saveArtifactAction(artifact: IArtifact): Promise<number> {
  if (typeof artifact.id === 'number') {
    db.update(schema.artifact)
      .set({
        jobId: artifact.jobId ?? null,
        applicationId: artifact.applicationId ?? null,
        parentArtifactId: artifact.parentArtifactId ?? null,
        kind: artifact.kind,
        prompt: artifact.prompt ?? null,
        inputHash: artifact.inputHash ?? null,
        content: artifact.content,
        filename: artifact.filename ?? null,
        storyId: artifact.storyId ?? null,
        usage: artifact.usage ?? null,
        pinned: artifact.pinned ?? null,
      })
      .where(eq(schema.artifact.id, artifact.id))
      .run();
    return artifact.id;
  }
  const result = db
    .insert(schema.artifact)
    .values({
      jobId: artifact.jobId ?? null,
      applicationId: artifact.applicationId ?? null,
      parentArtifactId: artifact.parentArtifactId ?? null,
      kind: artifact.kind,
      prompt: artifact.prompt ?? null,
      inputHash: artifact.inputHash ?? null,
      content: artifact.content,
      filename: artifact.filename ?? null,
      storyId: artifact.storyId ?? null,
      usage: artifact.usage ?? null,
      pinned: artifact.pinned ?? null,
      createdAt: artifact.createdAt,
    })
    .run();
  return Number(result.lastInsertRowid);
}

export async function pinArtifactAction(id: number, pinned: boolean): Promise<void> {
  db.update(schema.artifact)
    .set({ pinned })
    .where(eq(schema.artifact.id, id))
    .run();
}

/**
 * One-shot migration for cover-letter artifacts that pre-date the auto-sign
 * pass on /api/ai/cover-letter. Walks every cover-letter row, runs ensureSigned
 * against the candidate name, and only writes back the rows whose content
 * actually changed. Returns { updated, total } so the caller can show a
 * useful toast.
 *
 * Safe to run repeatedly: already-signed letters are a no-op.
 */
export async function resignCoverLetterArtifactsAction(
  candidateName: string,
): Promise<{ updated: number; total: number }> {
  const name = candidateName.trim();
  if (!name) return { updated: 0, total: 0 };

  const rows = db
    .select()
    .from(schema.artifact)
    .where(eq(schema.artifact.kind, EArtifactKind.CoverLetter))
    .all();

  let updated = 0;
  for (const row of rows) {
    const signed = ensureSigned(row.content, name);
    if (signed !== row.content) {
      db.update(schema.artifact)
        .set({ content: signed })
        .where(eq(schema.artifact.id, row.id))
        .run();
      updated += 1;
    }
  }

  return { updated, total: rows.length };
}
