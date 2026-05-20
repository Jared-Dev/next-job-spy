'use server';

import { eq } from 'drizzle-orm';

import { db, schema } from '@/lib/storage/local/sqlite/Database';
import { ESettingKey } from '@/lib/storage/types/ESettingKey';
import { SettingsSchema, type ISettings } from '@/lib/storage/types/ISettings';
import type { ISourceConfig } from '@/lib/storage/types/ISourceConfig';

function readMap(): Map<string, string> {
  const rows = db.select().from(schema.settings).all();
  return new Map(rows.map((r) => [r.key, r.value]));
}

function writeOne(key: string, value: string) {
  db.insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value, updatedAt: Math.floor(Date.now() / 1000) },
    })
    .run();
}

function deleteOne(key: string) {
  db.delete(schema.settings).where(eq(schema.settings.key, key)).run();
}

function parseSourceConfigs(raw: string | undefined): ISourceConfig[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as ISourceConfig[];
    return undefined;
  } catch {
    return undefined;
  }
}

export async function getSettingsAction(): Promise<ISettings> {
  const map = readMap();
  return SettingsSchema.parse({
    anthropicApiKey: map.get(ESettingKey.AnthropicApiKey),
    aiModel: map.get(ESettingKey.AiModel),
    aiMaxTokens: map.get(ESettingKey.AiMaxTokens)
      ? Number(map.get(ESettingKey.AiMaxTokens))
      : undefined,
    defaultTemplateId: map.get(ESettingKey.DefaultTemplateId),
    sourceConfigs: parseSourceConfigs(map.get(ESettingKey.SourceConfigs)),
    autoRefreshIntervalMin: map.get(ESettingKey.AutoRefreshIntervalMin)
      ? Number(map.get(ESettingKey.AutoRefreshIntervalMin))
      : undefined,
    lastRefreshAt: map.get(ESettingKey.LastRefreshAt)
      ? Number(map.get(ESettingKey.LastRefreshAt))
      : undefined,
  });
}

export async function saveSettingsAction(partial: Partial<ISettings>): Promise<void> {
  if (partial.anthropicApiKey !== undefined) {
    writeOne(ESettingKey.AnthropicApiKey, partial.anthropicApiKey);
  }
  if (partial.aiModel !== undefined) {
    writeOne(ESettingKey.AiModel, partial.aiModel);
  }
  if (partial.aiMaxTokens !== undefined) {
    writeOne(ESettingKey.AiMaxTokens, String(partial.aiMaxTokens));
  }
  if (partial.defaultTemplateId !== undefined) {
    writeOne(ESettingKey.DefaultTemplateId, partial.defaultTemplateId);
  }
  if (partial.sourceConfigs !== undefined) {
    writeOne(ESettingKey.SourceConfigs, JSON.stringify(partial.sourceConfigs));
  }
  if (partial.autoRefreshIntervalMin !== undefined) {
    writeOne(
      ESettingKey.AutoRefreshIntervalMin,
      String(partial.autoRefreshIntervalMin),
    );
  }
  if (partial.lastRefreshAt !== undefined) {
    writeOne(ESettingKey.LastRefreshAt, String(partial.lastRefreshAt));
  }
}

export async function hasApiKeyAction(): Promise<boolean> {
  const map = readMap();
  const fromDb = map.get(ESettingKey.AnthropicApiKey);
  const fromEnv = process.env.ANTHROPIC_API_KEY;
  return Boolean(fromDb || fromEnv);
}

export async function setApiKeyAction(key: string): Promise<void> {
  writeOne(ESettingKey.AnthropicApiKey, key);
}

export async function clearApiKeyAction(): Promise<void> {
  deleteOne(ESettingKey.AnthropicApiKey);
}

export async function getApiKeyAction(): Promise<string | null> {
  const map = readMap();
  return map.get(ESettingKey.AnthropicApiKey) ?? process.env.ANTHROPIC_API_KEY ?? null;
}

export async function hasAdminKeyAction(): Promise<boolean> {
  const map = readMap();
  const fromDb = map.get(ESettingKey.AnthropicAdminApiKey);
  const fromEnv = process.env.ANTHROPIC_ADMIN_API_KEY;
  return Boolean(fromDb || fromEnv);
}

export async function setAdminKeyAction(key: string): Promise<void> {
  writeOne(ESettingKey.AnthropicAdminApiKey, key);
}

export async function clearAdminKeyAction(): Promise<void> {
  deleteOne(ESettingKey.AnthropicAdminApiKey);
}

export async function getAdminKeyAction(): Promise<string | null> {
  const map = readMap();
  return (
    map.get(ESettingKey.AnthropicAdminApiKey) ??
    process.env.ANTHROPIC_ADMIN_API_KEY ??
    null
  );
}
