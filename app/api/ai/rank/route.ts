import { NextResponse } from 'next/server';
import { z } from 'zod';

import { agentErrorToResponse } from '@/lib/ai/agentErrorToResponse';
import { invokeClaudeAgent } from '@/lib/ai/invokeClaudeAgent';
import { parseJsonFromAgent } from '@/lib/ai/parseJsonFromAgent';
import { RANK_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import { RankRequestSchema } from '@/lib/ai/types/IRankRequest';
import type { IRankResult } from '@/lib/ai/types/IRankResult';

const ResponseSchema = z.object({
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

// Hard-line JSON instruction. Previous version said "no prose" as a
// single buried clause and Claude would still bail into conversation
// when an input looked incomplete. The MUST language and the
// explicit incomplete-data fallback close both holes: even if the
// candidate profile or a job description looks broken, the agent
// emits the schema (with a low fitScore + diagnostic fitNote)
// instead of asking us a question we cannot answer.
const AGENT_JSON_INSTRUCTION = `OUTPUT FORMAT (strict):
You MUST respond with a single JSON object and nothing else. No prose before or after. No markdown fences. No questions back to the user. Your reply must start with { and end with }.

Exact shape:
{ "results": [ { "id": "<the job's id from the input>", "fitScore": <0-100 integer>, "fitNotes": "<one sentence>" }, ... ] }

If a job description looks truncated, incomplete, or otherwise unscoreable, you still MUST emit the JSON. Use a low fitScore (0-20) and put the reason in fitNotes (e.g. "description truncated, cannot evaluate"). Never ask for more data; never narrate. JSON only.`;

const PARSE_RETRY_NUDGE = `Your previous response was not valid JSON. Respond again with JSON only, starting with { and ending with }, matching the schema above. No prose, no markdown, no questions.`;

export async function POST(request: Request) {
  let body: z.infer<typeof RankRequestSchema>;
  try {
    body = RankRequestSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const modelId = body.model ?? EAnthropicModel.Haiku45;
  const profileBlock = `CANDIDATE PROFILE:\n${JSON.stringify(body.profile)}`;
  const jobsBlock = `JOBS TO RANK:\n${JSON.stringify(body.jobs)}`;
  const systemPrompt = `${RANK_SYSTEM_PROMPT}\n\n${AGENT_JSON_INSTRUCTION}`;
  const userPrompt = `${profileBlock}\n\n${jobsBlock}`;

  try {
    const first = await invokeClaudeAgent({
      systemPrompt,
      userPrompt,
      model: modelId,
    });
    try {
      const parsed = parseJsonFromAgent(first.text, ResponseSchema);
      const payload: IRankResult = { results: parsed.results, usage: first.usage };
      return NextResponse.json(payload);
    } catch (parseErr) {
      // One-shot retry. The cost is small (Haiku, ~1k tokens) and
      // catches the rare case where Claude responded with prose
      // ("the input looks broken, could you..."). On the retry we
      // restate the format rule and include the bad response as
      // context so Claude self-corrects.
      console.warn(
        '[njs:rank] first response was not parseable JSON; retrying',
        parseErr instanceof Error ? parseErr.message : parseErr,
      );
      const retry = await invokeClaudeAgent({
        systemPrompt,
        userPrompt: `${userPrompt}\n\nYOUR PREVIOUS RESPONSE (not JSON, must be reformatted):\n${first.text.slice(0, 2000)}\n\n${PARSE_RETRY_NUDGE}`,
        model: modelId,
      });
      const parsed = parseJsonFromAgent(retry.text, ResponseSchema);
      // Sum the usage from both attempts so the caller sees the true
      // cost of this request (we paid for the first one too). Stamp
      // fields are camelCase per IUsageStamp.
      const combinedUsage = {
        ...retry.usage,
        inputTokens: first.usage.inputTokens + retry.usage.inputTokens,
        outputTokens: first.usage.outputTokens + retry.usage.outputTokens,
        cacheCreationInputTokens:
          first.usage.cacheCreationInputTokens + retry.usage.cacheCreationInputTokens,
        cacheReadInputTokens:
          first.usage.cacheReadInputTokens + retry.usage.cacheReadInputTokens,
        costUsd: first.usage.costUsd + retry.usage.costUsd,
      };
      const payload: IRankResult = { results: parsed.results, usage: combinedUsage };
      return NextResponse.json(payload);
    }
  } catch (err) {
    return agentErrorToResponse(err);
  }
}
