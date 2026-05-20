import type { ILeverJob } from './types/ILeverJob';

export async function fetchLeverCompany(company: string): Promise<ILeverJob[]> {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Lever company "${company}" returned ${res.status}`);
  }
  return (await res.json()) as ILeverJob[];
}
