import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { inferCountry } from '@/lib/jobs/inferCountry';

import * as schema from './schema';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.sqlite');

const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS profile (
  id            INTEGER PRIMARY KEY,
  full_name     TEXT,
  headline      TEXT,
  email         TEXT,
  phone         TEXT,
  location      TEXT,
  personal_site TEXT,
  links         TEXT,
  summary       TEXT,
  work_history    TEXT,
  education       TEXT,
  skills          TEXT,
  achievements    TEXT,
  preferences     TEXT,
  career_context  TEXT,
  source_markdown TEXT,
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS job (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source          TEXT NOT NULL,
  source_id       TEXT NOT NULL,
  url             TEXT NOT NULL,
  title           TEXT NOT NULL,
  company         TEXT NOT NULL,
  location        TEXT,
  country         TEXT,
  remote          INTEGER,
  salary_min      INTEGER,
  salary_max      INTEGER,
  salary_currency TEXT,
  posted_at       INTEGER,
  description_md  TEXT,
  raw             TEXT,
  discovered_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  fit_score       REAL,
  fit_notes       TEXT,
  status          TEXT NOT NULL DEFAULT 'new',
  UNIQUE (source, source_id)
);

CREATE TABLE IF NOT EXISTS application (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id        INTEGER NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'drafting',
  submitted_at  INTEGER,
  notes         TEXT,
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS artifact (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id              INTEGER REFERENCES job(id) ON DELETE CASCADE,
  application_id      INTEGER REFERENCES application(id) ON DELETE CASCADE,
  parent_artifact_id  INTEGER,
  kind                TEXT NOT NULL,
  template_id         TEXT,
  prompt              TEXT,
  input_hash          TEXT,
  content             TEXT NOT NULL,
  usage               TEXT,
  pinned              INTEGER,
  created_at          INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_artifact_input_hash ON artifact(input_hash);
`;

type TSqlite = Database.Database;
type TDb = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var nextJobSpyLocalSqlite: TSqlite | undefined;
  var nextJobSpyLocalDb: TDb | undefined;
}

function migrate(sqlite: TSqlite) {
  const artifactCols = sqlite.prepare('PRAGMA table_info(artifact)').all() as Array<{
    name: string;
  }>;
  if (!artifactCols.some((c) => c.name === 'input_hash')) {
    sqlite.exec('ALTER TABLE artifact ADD COLUMN input_hash TEXT');
    sqlite.exec(
      'CREATE INDEX IF NOT EXISTS idx_artifact_input_hash ON artifact(input_hash)',
    );
  }

  const jobCols = sqlite.prepare('PRAGMA table_info(job)').all() as Array<{
    name: string;
  }>;
  if (!jobCols.some((c) => c.name === 'country')) {
    sqlite.exec('ALTER TABLE job ADD COLUMN country TEXT');
  }
  // Idempotent — safe to run on every boot once the column exists.
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_job_country ON job(country)');

  // Backfill country for existing rows where it's null but we have a location.
  const needsBackfill = sqlite
    .prepare('SELECT id, location FROM job WHERE country IS NULL AND location IS NOT NULL')
    .all() as Array<{ id: number; location: string | null }>;
  if (needsBackfill.length > 0) {
    const update = sqlite.prepare('UPDATE job SET country = ? WHERE id = ?');
    const tx = sqlite.transaction((rows: typeof needsBackfill) => {
      for (const row of rows) {
        const code = inferCountry(row.location ?? undefined);
        if (code) update.run(code, row.id);
      }
    });
    tx(needsBackfill);
  }

  // Profile gained career_context, source_markdown, and a richer skills shape.
  const profileCols = sqlite.prepare('PRAGMA table_info(profile)').all() as Array<{
    name: string;
  }>;
  if (!profileCols.some((c) => c.name === 'career_context')) {
    sqlite.exec('ALTER TABLE profile ADD COLUMN career_context TEXT');
  }
  if (!profileCols.some((c) => c.name === 'source_markdown')) {
    sqlite.exec('ALTER TABLE profile ADD COLUMN source_markdown TEXT');
  }
  if (!profileCols.some((c) => c.name === 'personal_site')) {
    sqlite.exec('ALTER TABLE profile ADD COLUMN personal_site TEXT');
  }

  // Migrate skills from string[] to { name, strength }[]. Existing rows stored
  // a flat array of strings; convert each to a Proficient-rated skill object.
  const profileRow = sqlite
    .prepare('SELECT id, skills FROM profile WHERE id = 1')
    .get() as { id: number; skills: string | null } | undefined;
  if (profileRow?.skills) {
    try {
      const parsed = JSON.parse(profileRow.skills) as unknown;
      if (
        Array.isArray(parsed) &&
        parsed.some((s) => typeof s === 'string')
      ) {
        const upgraded = parsed.map((s) =>
          typeof s === 'string' ? { name: s, strength: 'proficient' } : s,
        );
        sqlite
          .prepare('UPDATE profile SET skills = ? WHERE id = 1')
          .run(JSON.stringify(upgraded));
      }
    } catch {
      // malformed skills JSON — leave it; the action layer parses defensively
    }
  }
}

function open(): { sqlite: TSqlite; db: TDb } {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(BOOTSTRAP_SQL);
  migrate(sqlite);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

if (!globalThis.nextJobSpyLocalSqlite || !globalThis.nextJobSpyLocalDb) {
  const { sqlite, db } = open();
  globalThis.nextJobSpyLocalSqlite = sqlite;
  globalThis.nextJobSpyLocalDb = db;
}

export const sqlite = globalThis.nextJobSpyLocalSqlite!;
export const db = globalThis.nextJobSpyLocalDb!;
export { schema };
