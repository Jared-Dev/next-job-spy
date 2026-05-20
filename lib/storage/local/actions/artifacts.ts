'use server';

import { desc, eq } from 'drizzle-orm';

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
    templateId: row.templateId ?? undefined,
    prompt: row.prompt ?? undefined,
    inputHash: row.inputHash ?? undefined,
    content: row.content,
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
        templateId: artifact.templateId ?? null,
        prompt: artifact.prompt ?? null,
        inputHash: artifact.inputHash ?? null,
        content: artifact.content,
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
      templateId: artifact.templateId ?? null,
      prompt: artifact.prompt ?? null,
      inputHash: artifact.inputHash ?? null,
      content: artifact.content,
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
