import { NextResponse } from 'next/server';
import { z } from 'zod';

import { agentErrorToResponse } from '@/lib/ai/agentErrorToResponse';
import { invokeClaudeAgent } from '@/lib/ai/invokeClaudeAgent';
import { COVER_LETTER_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import type { IGenerateResponse } from '@/lib/ai/types/IGenerateResponse';
import { CoverLetterRequestSchema } from '@/lib/ai/types/ICoverLetterRequest';

export async function POST(request: Request) {
  let body: z.infer<typeof CoverLetterRequestSchema>;
  try {
    body = CoverLetterRequestSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const modelId = body.model ?? EAnthropicModel.Sonnet46;

  const cachedContext = body.tailoredResume
    ? `TAILORED RESUME (use as the single source of truth for what this candidate has done):\n${body.tailoredResume}`
    : `CANDIDATE PROFILE:\n${JSON.stringify(body.profile)}`;

  const variableContext = `JOB POSTING:\nTitle: ${body.job.title}\nCompany: ${body.job.company}${
    body.job.location ? `\nLocation: ${body.job.location}` : ''
  }\n\n${body.job.description}\n\nNow write the cover letter body per the system rules.`;

  try {
    const { text, usage } = await invokeClaudeAgent({
      systemPrompt: COVER_LETTER_SYSTEM_PROMPT,
      userPrompt: `${cachedContext}\n\n${variableContext}`,
      model: modelId,
    });
    const payload: IGenerateResponse = { content: text, usage };
    return NextResponse.json(payload);
  } catch (err) {
    return agentErrorToResponse(err);
  }
}
