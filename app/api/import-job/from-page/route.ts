import { NextResponse } from 'next/server';
import { z } from 'zod';

import { htmlToMarkdown } from '@/lib/jobs/htmlToMarkdown';
import { extractWithReadability } from '@/lib/jobs/importJob/extractWithReadability';
import { parseJobPage } from '@/lib/jobs/importJob/parseJobPage';
import type { IImportedJob } from '@/lib/jobs/importJob/types/IImportedJob';

const MAX_HTML_CHARS = 800_000;

const FormSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  remote: z.string().optional(),
  descriptionHtml: z.string().optional(),
  descriptionText: z.string().optional(),
  fullPageHtml: z.string().optional(),
  site: z.string().optional(),
});

function parsedToImportedJob(input: z.infer<typeof FormSchema>): IImportedJob {
  const out: IImportedJob = {};
  if (input.title) out.title = input.title.trim() || undefined;
  if (input.company) out.company = input.company.trim() || undefined;
  if (input.location) out.location = input.location.trim() || undefined;
  if (input.remote) out.remote = input.remote === '1' || input.remote === 'true';
  if (input.descriptionHtml) {
    const md = htmlToMarkdown(input.descriptionHtml).trim();
    if (md) out.descriptionMd = md;
  } else if (input.descriptionText) {
    const md = input.descriptionText.trim();
    if (md) out.descriptionMd = md;
  }
  return out;
}

function mergeImported(a: IImportedJob, b: IImportedJob): IImportedJob {
  return {
    title: a.title ?? b.title,
    company: a.company ?? b.company,
    location: a.location ?? b.location,
    remote: a.remote ?? b.remote,
    descriptionMd:
      (a.descriptionMd?.length ?? 0) >= (b.descriptionMd?.length ?? 0)
        ? (a.descriptionMd ?? b.descriptionMd)
        : (b.descriptionMd ?? a.descriptionMd),
  };
}

const SITE_SUFFIXES = /\s*[|\-–—]\s*(?:LinkedIn|Indeed(?:\.com)?|Glassdoor)\s*$/i;

/**
 * Most aggregators emit `<title>` as `Role | Company | Site` or
 * `Role - Company - Site`. The bookmarklet's site-specific extractors
 * miss the company on layout variants we haven't accounted for, but the
 * `<title>` tag is almost always there. This recovers the clean role
 * and, when the company is otherwise unknown, lifts it out of the
 * "Role | Company | Site" middle slot.
 */
function cleanTitleAndCompany(merged: IImportedJob): IImportedJob {
  if (!merged.title) return merged;
  let title = merged.title.trim();
  let company = merged.company;

  const linkedInMatch = title.match(
    /^(.+?)\s*\|\s*(.+?)\s*\|\s*LinkedIn\s*$/i,
  );
  const indeedMatch = title.match(
    /^(.+?)\s*[-–—]\s*(.+?)\s*[-–—]\s*Indeed(?:\.com)?\s*$/i,
  );
  const tripleMatch = linkedInMatch ?? indeedMatch;
  if (tripleMatch) {
    title = tripleMatch[1].trim();
    if (!company) company = tripleMatch[2].trim();
  } else {
    title = title.replace(SITE_SUFFIXES, '').trim();
  }

  return { ...merged, title, company };
}

/**
 * Receives a payload from the bookmarklet (via the /clip handoff page)
 * and returns the merged extraction as JSON. The flow is preview-only:
 * /clip stashes the response in sessionStorage and navigates to /jobs,
 * where AddJobButton opens its modal pre-populated. The user reviews
 * and saves through the existing manual-add path, which handles the
 * actual job creation and Claude scoring. That keeps location/company
 * mistakes recoverable instead of landing them in the DB.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Bookmarklet must POST form-encoded data.' },
      { status: 400 },
    );
  }

  const raw: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === 'string') raw[k] = v.slice(0, MAX_HTML_CHARS);
  }

  let parsed: z.infer<typeof FormSchema>;
  try {
    parsed = FormSchema.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid form data';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const direct = parsedToImportedJob(parsed);
  let merged = direct;
  if (parsed.fullPageHtml) {
    const fromStructured = parseJobPage(parsed.fullPageHtml);
    const fromReadability = extractWithReadability(parsed.fullPageHtml);
    merged = mergeImported(merged, fromStructured);
    merged = mergeImported(merged, fromReadability);
  }
  merged = cleanTitleAndCompany(merged);

  return NextResponse.json({
    url: parsed.url,
    fields: merged,
  });
}
