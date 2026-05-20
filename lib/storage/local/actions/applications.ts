'use server';

import { desc, eq } from 'drizzle-orm';

import { db, schema } from '@/lib/storage/local/sqlite/Database';
import { EApplicationStatus } from '@/lib/storage/types/EApplicationStatus';
import type { IApplication } from '@/lib/storage/types/IApplication';

function rowToApp(row: typeof schema.application.$inferSelect): IApplication {
  return {
    id: row.id,
    jobId: row.jobId,
    status: row.status as EApplicationStatus,
    submittedAt: row.submittedAt ?? undefined,
    notes: row.notes ?? undefined,
    updatedAt: row.updatedAt,
  };
}

export async function listApplicationsAction(): Promise<IApplication[]> {
  const rows = await db
    .select()
    .from(schema.application)
    .orderBy(desc(schema.application.updatedAt))
    .all();
  return rows.map(rowToApp);
}

export async function upsertApplicationAction(app: IApplication): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  if (typeof app.id === 'number') {
    db.update(schema.application)
      .set({
        jobId: app.jobId,
        status: app.status,
        submittedAt: app.submittedAt ?? null,
        notes: app.notes ?? null,
        updatedAt: now,
      })
      .where(eq(schema.application.id, app.id))
      .run();
  } else {
    db.insert(schema.application)
      .values({
        jobId: app.jobId,
        status: app.status,
        submittedAt: app.submittedAt ?? null,
        notes: app.notes ?? null,
        updatedAt: now,
      })
      .run();
  }
}
