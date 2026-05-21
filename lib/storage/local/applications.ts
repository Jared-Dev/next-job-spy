'use client';

import { useEffect, useState } from 'react';

import type { IApplication } from '@/lib/storage/types/IApplication';

import {
  listApplicationsAction,
  upsertApplicationAction,
} from './actions/applications';
import { REFRESH_EVENTS, emitRefresh } from './refreshEvents';

export function useApplications(): IApplication[] | undefined {
  const [apps, setApps] = useState<IApplication[] | undefined>();
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      listApplicationsAction().then((a) => {
        if (!cancelled) setApps(a);
      });
    };
    load();
    if (typeof window !== 'undefined') {
      window.addEventListener(REFRESH_EVENTS.Applications, load);
      return () => {
        cancelled = true;
        window.removeEventListener(REFRESH_EVENTS.Applications, load);
      };
    }
    return () => {
      cancelled = true;
    };
  }, []);
  return apps;
}

export async function upsertApplication(app: IApplication): Promise<number> {
  const id = await upsertApplicationAction(app);
  emitRefresh(REFRESH_EVENTS.Applications);
  return id;
}
