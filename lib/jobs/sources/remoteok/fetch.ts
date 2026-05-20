import type { IRemoteOkJob } from './types/IRemoteOkJob';

export async function fetchRemoteOk(): Promise<IRemoteOkJob[]> {
  const res = await fetch('https://remoteok.com/api', {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'next-job-spy (personal job search)',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`RemoteOK returned ${res.status}`);
  }
  const data = (await res.json()) as IRemoteOkJob[];
  return data.filter((entry) => !entry.legal && entry.position);
}
