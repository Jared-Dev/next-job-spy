'use client';

import { useEffect, useState } from 'react';

import type { IProfile } from '@/lib/storage/types/IProfile';

import { getProfileAction, saveProfileAction } from './actions/profile';
import { REFRESH_EVENTS, emitRefresh } from './refreshEvents';

export function useProfile(): IProfile | undefined {
  const [profile, setProfile] = useState<IProfile | undefined>();
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getProfileAction().then((p) => {
        if (!cancelled) setProfile(p ?? {});
      });
    };
    load();
    if (typeof window !== 'undefined') {
      window.addEventListener(REFRESH_EVENTS.Profile, load);
      return () => {
        cancelled = true;
        window.removeEventListener(REFRESH_EVENTS.Profile, load);
      };
    }
    return () => {
      cancelled = true;
    };
  }, []);
  return profile;
}

export async function saveProfile(profile: IProfile): Promise<void> {
  await saveProfileAction(profile);
  emitRefresh(REFRESH_EVENTS.Profile);
}
