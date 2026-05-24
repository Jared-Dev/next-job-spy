/// <reference lib="webworker" />

import {
  CreateMLCEngine,
  type MLCEngineInterface,
} from '@mlc-ai/web-llm';

import { buildJobPrompt, buildSystemPrompt } from './prompt';
import type {
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

self.addEventListener('message', (event: MessageEvent<TWorkerInbound>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'init':
      void init(msg.webllmModelId);
      break;
    case 'screen':
      void screen(msg);
      break;
    case 'terminate':
      self.close();
      break;
  }
});
