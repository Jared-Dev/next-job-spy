import { NextResponse } from 'next/server';

import { agentErrorToResponse } from '@/lib/ai/agentErrorToResponse';
import { invokeClaudeAgent } from '@/lib/ai/invokeClaudeAgent';
import { parseJsonFromAgent } from '@/lib/ai/parseJsonFromAgent';
import { RANK_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import { htmlToMarkdown } from '@/lib/jobs/htmlToMarkdown';
import { extractWithReadability } from '@/lib/jobs/importJob/extractWithReadability';
import { parseJobPage } from '@/lib/jobs/importJob/parseJobPage';
import type { IImportedJob } from '@/lib/jobs/importJob/types/IImportedJob';
import { inferCountry } from '@/lib/jobs/inferCountry';
import { isProfileMeaningful } from '@/lib/profile/isProfileMeaningful';
import { createJobAction, updateJobFitAction } from '@/lib/storage/local/actions/jobs';
import { getProfileAction } from '@/lib/storage/local/actions/profile';
import { EJobStatus } from '@/lib/storage/types/EJobStatus';
import { ESourceId } from '@/lib/storage/types/ESourceId';
import type { IJob } from '@/lib/storage/types/IJob';
import { z } from 'zod';

const RANK_DESCRIPTION_CAP = 4000;
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

const RankResponseSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.string(),
        fitScore: z.number().int().min(0).max(100),
        fitNotes: z.string(),
      }),
    )
    .min(1),
});

/**
 * Score the freshly-imported job in the background. Mirrors the
 * client-side fire-and-forget in AddJobButton; the redirect already
 * returned, so any failure here is silently dropped.
 */
async function scoreInBackground(jobId: number, job: IJob): Promise<void> {
  try {
    const profile = await getProfileAction();
    if (!isProfileMeaningful(profile ?? undefined)) return;
    const description = job.descriptionMd ?? '';
    const truncated =
      description.length > RANK_DESCRIPTION_CAP
        ? `${description.slice(0, RANK_DESCRIPTION_CAP)}\n\n[Description truncated by server at ${RANK_DESCRIPTION_CAP} chars; score what is shown.]`
        : description;
    const userPrompt = `CANDIDATE PROFILE:\n${JSON.stringify(profile)}\n\nJOBS TO RANK:\n${JSON.stringify([
      {
        id: String(jobId),
        title: job.title,
        company: job.company,
        location: job.location,
        description: truncated,
      },
    ])}`;
    const { text } = await invokeClaudeAgent({
      systemPrompt: `${RANK_SYSTEM_PROMPT}\n\nOUTPUT FORMAT: Reply with JSON only matching { "results": [ { "id": string, "fitScore": int 0-100, "fitNotes": string } ] }. No prose, no markdown.`,
      userPrompt,
      model: EAnthropicModel.Haiku45,
    });
    const parsed = parseJsonFromAgent(text, RankResponseSchema);
    const result = parsed.results[0];
    if (!result) return;
    await updateJobFitAction(jobId, result.fitScore, result.fitNotes);
  } catch (err) {
    // Best-effort. The job still exists; the user can hit Rank from /jobs.
    console.warn(
      '[njs:bookmarklet] background scoring failed',
      err instanceof Error ? err.message : err,
    );
  }
}

function unixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

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

  if (!merged.title || !merged.descriptionMd) {
    return NextResponse.json(
      {
        error:
          "Couldn't read enough off that page. Open the Add job modal in Next Job Spy and fill the fields in by hand.",
      },
      { status: 422 },
    );
  }

  const now = unixSeconds();
  const location = merged.location?.trim();
  const job: IJob = {
    source: ESourceId.Manual,
    sourceId: crypto.randomUUID(),
    url: parsed.url,
    title: merged.title.trim(),
    company: (merged.company ?? 'Unknown').trim(),
    location: location || undefined,
    country: inferCountry(location ?? ''),
    remote: merged.remote,
    descriptionMd: merged.descriptionMd.trim(),
    discoveredAt: now,
    status: EJobStatus.Saved,
  };

  let id: number;
  try {
    id = await createJobAction(job);
  } catch (err) {
    return agentErrorToResponse(err);
  }

  // Block on scoring (with a hard ceiling) so the user lands on a
  // /jobs/<id> page that already shows the fit score. Without this the
  // job appears unscored and stays that way until the user manually
  // refreshes, because server-side updateJobFitAction doesn't fire the
  // client-side refresh event. 20s is well over the typical Haiku run
  // (~3-6s) and short enough that a stalled call doesn't keep the user
  // staring at the /clip loader forever.
  const scoringDeadline = new Promise<void>((resolve) => {
    setTimeout(resolve, 20_000);
  });
  await Promise.race([scoreInBackground(id, job), scoringDeadline]);

  const redirectUrl = new URL(`/jobs/${id}`, request.url);
  return NextResponse.redirect(redirectUrl, 303);
}
