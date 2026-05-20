'use server';

import { eq } from 'drizzle-orm';

import { db, schema } from '@/lib/storage/local/sqlite/Database';
import type { IProfile } from '@/lib/storage/types/IProfile';
import { ProfileSchema } from '@/lib/storage/types/IProfile';

export async function getProfileAction(): Promise<IProfile | null> {
  const row = db.select().from(schema.profile).where(eq(schema.profile.id, 1)).get();
  if (!row) return null;
  return {
    fullName: row.fullName ?? undefined,
    headline: row.headline ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    location: row.location ?? undefined,
    personalSite: row.personalSite ?? undefined,
    links: row.links ?? undefined,
    summary: row.summary ?? undefined,
    workHistory: row.workHistory ?? undefined,
    education: row.education ?? undefined,
    skills: row.skills ?? undefined,
    achievements: row.achievements ?? undefined,
    preferences: row.preferences ?? undefined,
    careerContext: row.careerContext ?? undefined,
    sourceMarkdown: row.sourceMarkdown ?? undefined,
  };
}

export async function saveProfileAction(input: unknown): Promise<void> {
  const data = ProfileSchema.parse(input);
  const now = Math.floor(Date.now() / 1000);
  const values = {
    id: 1,
    fullName: data.fullName ?? null,
    headline: data.headline ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    location: data.location ?? null,
    personalSite: data.personalSite ?? null,
    links: data.links ?? null,
    summary: data.summary ?? null,
    workHistory: data.workHistory ?? null,
    education: data.education ?? null,
    skills: data.skills ?? null,
    achievements: data.achievements ?? null,
    preferences: data.preferences ?? null,
    careerContext: data.careerContext ?? null,
    sourceMarkdown: data.sourceMarkdown ?? null,
    updatedAt: now,
  };
  db.insert(schema.profile)
    .values(values)
    .onConflictDoUpdate({
      target: schema.profile.id,
      set: { ...values, id: undefined },
    })
    .run();
}
