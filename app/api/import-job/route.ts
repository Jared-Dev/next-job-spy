import { NextResponse } from 'next/server';
import { z } from 'zod';

import { invokeClaudeAgent } from '@/lib/ai/invokeClaudeAgent';
import { parseJsonFromAgent } from '@/lib/ai/parseJsonFromAgent';
import { IMPORT_JOB_SYSTEM } from '@/lib/ai/prompts';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import { parseJobPage } from '@/lib/jobs/importJob/parseJobPage';
import {
  ImportedJobSchema,
  type IImportedJob,
} from '@/lib/jobs/importJob/types/IImportedJob';

const RequestSchema = z.object({
  url: z.string().url(),
  useAi: z.boolean().default(true),
});

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_CHARS = 600_000;
const AI_TEXT_CHARS = 16_000;
const SUBSTANTIAL_DESCRIPTION = 240;

/** Thin = missing a title or lacking a real (non-blurb) description. */
function isThin(fields: IImportedJob): boolean {
  return (
    !fields.title ||
    !fields.descriptionMd ||
    fields.descriptionMd.length < SUBSTANTIAL_DESCRIPTION
  );
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const target = new URL(body.url);
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return NextResponse.json(
      { error: 'Only http(s) URLs can be imported.' },
      { status: 400 },
    );
  }

  let html: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(body.url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; NextJobSpy/1.0)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return NextResponse.json(
        { error: `The posting URL returned HTTP ${res.status}.` },
        { status: 502 },
      );
    }
    html = (await res.text()).slice(0, MAX_HTML_CHARS);
  } catch {
    return NextResponse.json(
      {
        error:
          'Could not fetch that URL. The site may block automated requests (LinkedIn often does). Fill the form in by hand.',
      },
      { status: 502 },
    );
  }

  const structured = parseJobPage(html);

  if (!isThin(structured) || !body.useAi) {
    const gotSomething = Boolean(
      structured.title || structured.company || structured.descriptionMd,
    );
    const via = !isThin(structured) ? 'structured' : gotSomething ? 'partial' : 'none';
    return NextResponse.json({ fields: structured, via });
  }

  // Structured data was thin, so fall back to an AI extraction pass.
  try {
    const pageText = htmlToPlainText(html).slice(0, AI_TEXT_CHARS);
    const { text } = await invokeClaudeAgent({
      systemPrompt: IMPORT_JOB_SYSTEM,
      userPrompt: `JOB POSTING PAGE TEXT:\n\n${pageText}`,
      model: EAnthropicModel.Haiku45,
    });
    const ai = parseJsonFromAgent(text, ImportedJobSchema);
    const structuredDescriptionOk =
      (structured.descriptionMd?.length ?? 0) >= SUBSTANTIAL_DESCRIPTION;
    const merged: IImportedJob = {
      title: structured.title ?? ai.title,
      company: structured.company ?? ai.company,
      location: structured.location ?? ai.location,
      remote: structured.remote ?? ai.remote,
      descriptionMd: structuredDescriptionOk
        ? structured.descriptionMd
        : (ai.descriptionMd ?? structured.descriptionMd),
    };
    return NextResponse.json({ fields: merged, via: 'ai' });
  } catch (err) {
    // AI assist failed; return the partial structured parse rather than
    // discarding it. The import is best-effort by design.
    return NextResponse.json({
      fields: structured,
      via: 'partial',
      note: err instanceof Error ? err.message : undefined,
    });
  }
}
