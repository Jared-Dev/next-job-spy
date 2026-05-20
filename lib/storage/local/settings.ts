'use client';

import { useEffect, useState } from 'react';

import type { ISettings } from '@/lib/storage/types/ISettings';

import { getSettingsAction, saveSettingsAction } from './actions/settings';
import { REFRESH_EVENTS, emitRefresh } from './refreshEvents';

export function useSettings(): ISettings | undefined {
  const [settings, setSettings] = useState<ISettings | undefined>();
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getSettingsAction().then((s) => {
        if (!cancelled) setSettings(s);
      });
    };
    load();
    if (typeof window !== 'undefined') {
      window.addEventListener(REFRESH_EVENTS.Settings, load);
      return () => {
        cancelled = true;
        window.removeEventListener(REFRESH_EVENTS.Settings, load);
      };
    }
    return () => {
      cancelled = true;
    };
  }, []);
  return settings;
}

export async function saveSettings(partial: Partial<ISettings>): Promise<void> {
  await saveSettingsAction(partial);
  emitRefresh(REFRESH_EVENTS.Settings);
}
