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

const AGENT_JSON_INSTRUCTION = `Respond with a single JSON object — no prose, no markdown fences — matching this exact shape:
{ "results": [ { "id": "<the job's id from the input>", "fitScore": <0-100 integer>, "fitNotes": "<one sentence>" }, ... ] }`;

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

  try {
    const { text, usage } = await invokeClaudeAgent({
      systemPrompt: `${RANK_SYSTEM_PROMPT}\n\n${AGENT_JSON_INSTRUCTION}`,
      userPrompt: `${profileBlock}\n\n${jobsBlock}`,
      model: modelId,
    });
    const parsed = parseJsonFromAgent(text, ResponseSchema);
    const payload: IRankResult = { results: parsed.results, usage };
    return NextResponse.json(payload);
  } catch (err) {
    return agentErrorToResponse(err);
  }
}
