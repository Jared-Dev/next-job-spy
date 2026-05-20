import type { IWwrItem } from './types/IWwrItem';

const CDATA = /<!\[CDATA\[([\s\S]*?)\]\]>/;

function tag(item: string, name: string): string | undefined {
  const match = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`));
  if (!match) return undefined;
  const inner = match[1].trim();
  const cdata = inner.match(CDATA);
  return cdata ? cdata[1].trim() : inner;
}

export async function fetchWwrCategory(category: string): Promise<IWwrItem[]> {
  const url = `https://weworkremotely.com/categories/${encodeURIComponent(category)}.rss`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml',
      'User-Agent': 'next-job-spy (personal job search)',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`WWR category "${category}" returned ${res.status}`);
  }
  const xml = await res.text();
  const items: IWwrItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const body = m[1];
    const guid = tag(body, 'guid') ?? tag(body, 'link') ?? '';
    const title = tag(body, 'title') ?? '';
    const link = tag(body, 'link') ?? '';
    if (!title || !link) continue;
    items.push({
      guid,
      title,
      link,
      description: tag(body, 'description'),
      pubDate: tag(body, 'pubDate'),
    });
  }
  return items;
}
