import type { IGreenhouseJob } from './types/IGreenhouseJob';

export async function fetchGreenhouseBoard(boardSlug: string): Promise<IGreenhouseJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
    boardSlug,
  )}/jobs?content=true`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Greenhouse board "${boardSlug}" returned ${res.status}`);
  }
  const data = (await res.json()) as { jobs?: IGreenhouseJob[] };
  return data.jobs ?? [];
}
