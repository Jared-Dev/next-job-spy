import { htmlToMarkdown } from '@/lib/jobs/htmlToMarkdown';

import type { IImportedJob } from './types/IImportedJob';

function asText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Walk a parsed JSON-LD value for the first schema.org JobPosting node. */
function findJobPosting(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  const obj = node as Record<string, unknown>;
  const type = obj['@type'];
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) {
    return obj;
  }
  if ('@graph' in obj) return findJobPosting(obj['@graph']);
  return null;
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(block[1].trim());
    } catch {
      continue;
    }
    const posting = findJobPosting(data);
    if (posting) return posting;
  }
  return null;
}

function extractCompany(value: unknown): string | undefined {
  if (typeof value === 'string') return asText(value);
  if (value && typeof value === 'object') {
    return asText((value as Record<string, unknown>).name);
  }
  return undefined;
}

function extractLocation(value: unknown): string | undefined {
  const place = Array.isArray(value) ? value[0] : value;
  if (!place || typeof place !== 'object') return undefined;
  const address = (place as Record<string, unknown>).address;
  if (typeof address === 'string') return asText(address);
  if (!address || typeof address !== 'object') return undefined;
  const a = address as Record<string, unknown>;
  const country =
    a.addressCountry && typeof a.addressCountry === 'object'
      ? asText((a.addressCountry as Record<string, unknown>).name)
      : asText(a.addressCountry);
  const parts = [
    asText(a.addressLocality),
    asText(a.addressRegion),
    country,
  ].filter((p): p is string => p !== undefined);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function metaContent(html: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`,
      'i',
    ),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match) return asText(match[1]);
  }
  return undefined;
}

function titleTag(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? asText(match[1].replace(/\s+/g, ' ')) : undefined;
}

/**
 * Best-effort extraction of job fields from a posting's HTML — schema.org
 * JobPosting JSON-LD first, then OpenGraph / `<title>` as a fallback.
 * Pure: never throws; returns whatever it could find.
 */
export function parseJobPage(html: string): IImportedJob {
  const result: IImportedJob = {};
  const posting = extractJsonLd(html);

  if (posting) {
    result.title = asText(posting.title);
    result.company = extractCompany(posting.hiringOrganization);
    result.location = extractLocation(posting.jobLocation);
    if (posting.jobLocationType === 'TELECOMMUTE') result.remote = true;
    const description = asText(posting.description);
    if (description) result.descriptionMd = htmlToMarkdown(description);
  }

  if (!result.title) {
    result.title = metaContent(html, 'og:title') ?? titleTag(html);
  }
  if (!result.descriptionMd) {
    result.descriptionMd = metaContent(html, 'og:description');
  }

  return result;
}
