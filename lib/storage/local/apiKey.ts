'use client';

import {
  clearAdminKeyAction,
  clearApiKeyAction,
  hasAdminKeyAction,
  hasApiKeyAction,
  setAdminKeyAction,
  setApiKeyAction,
} from './actions/settings';
import { REFRESH_EVENTS, emitRefresh } from './refreshEvents';

export async function hasApiKey(): Promise<boolean> {
  return hasApiKeyAction();
}

export async function setApiKey(key: string): Promise<void> {
  await setApiKeyAction(key);
  emitRefresh(REFRESH_EVENTS.ApiKey);
  emitRefresh(REFRESH_EVENTS.Settings);
}

export async function clearApiKey(): Promise<void> {
  await clearApiKeyAction();
  emitRefresh(REFRESH_EVENTS.ApiKey);
  emitRefresh(REFRESH_EVENTS.Settings);
}

export async function hasAdminKey(): Promise<boolean> {
  return hasAdminKeyAction();
}

export async function setAdminKey(key: string): Promise<void> {
  await setAdminKeyAction(key);
  emitRefresh(REFRESH_EVENTS.ApiKey);
  emitRefresh(REFRESH_EVENTS.Settings);
}

export async function clearAdminKey(): Promise<void> {
  await clearAdminKeyAction();
  emitRefresh(REFRESH_EVENTS.ApiKey);
  emitRefresh(REFRESH_EVENTS.Settings);
}
