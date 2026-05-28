/// <reference lib="webworker" />

import {
  CreateMLCEngine,
  type MLCEngineInterface,
} from '@mlc-ai/web-llm';

import { buildJobPrompt, buildSystemPrompt } from './prompt';
import type {
  ILocalRankItem,
  ILocalRankStory,
  ILocalScreenJob,
  TWorkerInbound,
  TWorkerOutbound,
} from './types';

declare const self: DedicatedWorkerGlobalScope;

/**
 * JSON schema we constrain the model to. Passed to WebLLM's
 * GrammarCompiler so the generated tokens MUST form a valid object
 * matching this shape. Removes the freeform-prose failure mode that
 * was sending almost everything to the "defaulted to pass" branch
 * when Phi felt like writing analysis instead of JSON.
 *
 * The compiler expects a string, not an object; we stringify once
 * at module load.
 */
const VERDICT_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'reject'] },
    reason: { type: 'string', maxLength: 240 },
  },
  required: ['verdict', 'reason'],
  additionalProperties: false,
});

let engine: MLCEngineInterface | null = null;
let loadingFor: string | null = null;

function send(msg: TWorkerOutbound): void {
  self.postMessage(msg);
}

async function init(webllmModelId: string): Promise<void> {
  if (engine) {
    console.log('[njs:local-worker] init no-op, engine already ready');
    send({ type: 'ready' });
    return;
  }
  if (loadingFor === webllmModelId) {
    console.log('[njs:local-worker] init already in flight for', webllmModelId);
    return;
  }
  loadingFor = webllmModelId;
  const startedAt = Date.now();
  console.log('[njs:local-worker] init starting', webllmModelId);
  try {
    engine = await CreateMLCEngine(webllmModelId, {
      initProgressCallback: (report) => {
        send({
          type: 'progress',
          text: report.text,
          progress: report.progress,
        });
      },
    });
    console.log(
      '[njs:local-worker] engine ready after',
      Math.round((Date.now() - startedAt) / 1000),
      's',
    );
    send({ type: 'ready' });
  } catch (err) {
    engine = null;
    console.error('[njs:local-worker] init failed', err);
    send({
      type: 'error',
      message: err instanceof Error ? err.message : 'Unknown engine init error',
    });
  } finally {
    loadingFor = null;
  }
}

function parseVerdict(
  raw: string | null | undefined,
): { verdict: 'pass' | 'reject'; reason: string } {
  if (!raw) {
    return {
      verdict: 'pass',
      reason: 'Empty response from local model (defaulted to pass).',
    };
  }
  // Some small models wrap JSON in ```json fences despite instructions.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    const obj = JSON.parse(cleaned) as { verdict?: unknown; reason?: unknown };
    const verdict = obj.verdict === 'reject' ? 'reject' : 'pass';
    const reason =
      typeof obj.reason === 'string' && obj.reason.trim()
        ? obj.reason.trim().slice(0, 240)
        : verdict === 'reject'
          ? 'Local model flagged this as a mismatch.'
          : '';
    return { verdict, reason };
  } catch {
    // Non-JSON output is a model failure, not a job rejection. Default to
    // pass so we never drop jobs because the small model returned prose.
    return {
      verdict: 'pass',
      reason: 'Local model returned non-JSON; defaulted to pass.',
    };
  }
}

async function screen(
  payload: Extract<TWorkerInbound, { type: 'screen' }>,
): Promise<void> {
  if (!engine) {
    console.error('[njs:local-worker] screen called with no engine');
    send({
      type: 'error',
      jobId: payload.job.id,
      message: 'Local engine is not ready; cannot screen.',
    });
    return;
  }
  const startedAt = Date.now();
  console.log('[njs:local-worker] screening job', payload.job.id);
  try {
    // Constrained generation via explicit JSON schema string. Without
    // a schema, WebLLM 0.2.x's GrammarCompiler.CompileJSONSchema
    // throws "Cannot pass non-string to std::string"; without
    // constraints at all, small models freely produce analysis prose
    // that parseVerdict has to default to pass. Passing the schema
    // closes both holes.
    const completion = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: buildSystemPrompt(payload.profile) },
        { role: 'user', content: buildJobPrompt(payload.job) },
      ],
      response_format: {
        type: 'json_object',
        schema: VERDICT_SCHEMA,
      },
      temperature: 0,
      max_tokens: 200,
    });
    const elapsed = Math.round((Date.now() - startedAt) / 100) / 10;
    const raw = completion.choices?.[0]?.message?.content;
    const { verdict, reason } = parseVerdict(raw);
    console.log(
      '[njs:local-worker] verdict for',
      payload.job.id,
      `(${elapsed}s):`,
      verdict,
      reason,
    );
    send({ type: 'verdict', jobId: payload.job.id, verdict, reason });
  } catch (err) {
    const elapsed = Math.round((Date.now() - startedAt) / 100) / 10;
    console.error(
      '[njs:local-worker] screen failed for',
      payload.job.id,
      `(${elapsed}s):`,
      err,
    );
    send({
      type: 'error',
      jobId: payload.job.id,
      message: err instanceof Error ? err.message : 'Unknown screen error',
    });
  }
}

const RANK_SYSTEM_PROMPT = `You are picking the candidate's strongest STORY for a job posting. Each story is a personal vignette the candidate wants a recruiter to read; they are NOT resume rehashes. Judge fit on tone, themes, and what the story communicates about the candidate that this specific role would value.

You will receive a job posting and a numbered list of stories. Rank ALL stories from best-fit to worst-fit. For each, write ONE short sentence (max 20 words) on why it fits or doesn't.

CRITICAL RULES:
- Output ONLY a JSON object matching the schema. No prose, no markdown fences.
- Every story id from the input MUST appear in the output exactly once.
- Do not invent ids. Use the exact ids from the input.
- "why" is one short sentence, never multiple sentences, never a list.
- Match LEVEL (IC vs leadership vs founding/staff), DOMAIN (frontend, infra, ops...), and TONE (steady builder, hard-charging, polished consultant, scrappy operator). A leadership story for an IC role is wrong; an IC story for a leadership role is wrong.
- Avoid keyword matching. Look at the story's takeaway, the kind of work it celebrates, the kind of person it makes the candidate sound like.`;

function buildRankSchema(storyCount: number): string {
  return JSON.stringify({
    type: 'object',
    properties: {
      ranked: {
        type: 'array',
        minItems: storyCount,
        maxItems: storyCount,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            why: { type: 'string', maxLength: 200 },
          },
          required: ['id', 'why'],
          additionalProperties: false,
        },
      },
    },
    required: ['ranked'],
    additionalProperties: false,
  });
}

function buildRankUserPrompt(
  job: ILocalScreenJob,
  stories: ILocalRankStory[],
): string {
  const jobBlock = `JOB POSTING\nTitle: ${job.title}\nCompany: ${job.company}${
    job.location ? `\nLocation: ${job.location}` : ''
  }\n\n${(job.descriptionMd ?? '').slice(0, 4000)}`;

  const storiesBlock = stories
    .map(
      (s) =>
        `Story id: ${s.id}\nTitle: ${s.title}\n${s.content.slice(0, 1200)}`,
    )
    .join('\n\n---\n\n');

  return `${jobBlock}\n\n=====\n\nSTORIES (${stories.length} total):\n\n${storiesBlock}\n\nNow output the JSON: { "ranked": [{ "id": "<exact id>", "why": "<one short sentence>" }, ...] } in best-first order. Include every id exactly once.`;
}

function parseRankResult(
  raw: string | null | undefined,
  knownIds: Set<string>,
): { ok: true; items: ILocalRankItem[] } | { ok: false; reason: string } {
  if (!raw) return { ok: false, reason: 'Empty response from local model.' };
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, reason: 'Local model returned non-JSON.' };
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('ranked' in parsed) ||
    !Array.isArray((parsed as { ranked: unknown }).ranked)
  ) {
    return { ok: false, reason: 'Ranking response was not the expected shape.' };
  }
  const items: ILocalRankItem[] = [];
  const seen = new Set<string>();
  for (const entry of (parsed as { ranked: unknown[] }).ranked) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof (entry as { id?: unknown }).id !== 'string'
    ) {
      continue;
    }
    const id = (entry as { id: string }).id;
    if (!knownIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    const whyRaw = (entry as { why?: unknown }).why;
    const why =
      typeof whyRaw === 'string'
        ? whyRaw.trim().slice(0, 200)
        : '';
    items.push({ storyId: id, why });
  }
  // Append any missing stories at the bottom with an empty rationale so the
  // caller always gets a complete list (and can decide to retry if the model
  // dropped ids).
  for (const id of knownIds) {
    if (!seen.has(id)) items.push({ storyId: id, why: '' });
  }
  if (items.length === 0) {
    return { ok: false, reason: 'Ranking returned no usable items.' };
  }
  return { ok: true, items };
}

async function rank(
  payload: Extract<TWorkerInbound, { type: 'rank' }>,
): Promise<void> {
  if (!engine) {
    send({
      type: 'rankingError',
      requestId: payload.requestId,
      message: 'Local engine is not ready; cannot rank.',
    });
    return;
  }
  const startedAt = Date.now();
  const knownIds = new Set(payload.stories.map((s) => s.id));
  try {
    const completion = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: RANK_SYSTEM_PROMPT },
        { role: 'user', content: buildRankUserPrompt(payload.job, payload.stories) },
      ],
      response_format: {
        type: 'json_object',
        schema: buildRankSchema(payload.stories.length),
      },
      temperature: 0,
      // Per story: ~30 tokens of "why" + JSON overhead. 80 tokens per story
      // gives plenty of headroom; capped at 1024 so the model can't run away.
      max_tokens: Math.min(1024, 80 * payload.stories.length + 64),
    });
    const elapsed = Math.round((Date.now() - startedAt) / 100) / 10;
    const raw = completion.choices?.[0]?.message?.content;
    const result = parseRankResult(raw, knownIds);
    if (!result.ok) {
      console.warn(
        '[njs:local-worker] rank parse failed',
        `(${elapsed}s):`,
        result.reason,
      );
      send({
        type: 'rankingError',
        requestId: payload.requestId,
        message: result.reason,
      });
      return;
    }
    console.log(
      '[njs:local-worker] rank done',
      `(${elapsed}s, ${result.items.length} items)`,
    );
    send({
      type: 'ranking',
      requestId: payload.requestId,
      items: result.items,
    });
  } catch (err) {
    console.error('[njs:local-worker] rank failed', err);
    send({
      type: 'rankingError',
      requestId: payload.requestId,
      message: err instanceof Error ? err.message : 'Unknown rank error',
    });
  }
}

self.addEventListener('message', (event: MessageEvent<TWorkerInbound>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'init':
      void init(msg.webllmModelId);
      break;
    case 'screen':
      void screen(msg);
      break;
    case 'rank':
      void rank(msg);
      break;
    case 'terminate':
      self.close();
      break;
  }
});
