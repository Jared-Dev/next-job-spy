import { NextResponse } from 'next/server';
import { z } from 'zod';

import { agentErrorToResponse } from '@/lib/ai/agentErrorToResponse';
import { invokeClaudeAgentForDocument } from '@/lib/ai/invokeClaudeAgentForDocument';
import { COVER_LETTER_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { trimProfileForGeneration } from '@/lib/ai/trimProfileForGeneration';
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
  const trimmedProfile = trimProfileForGeneration(body.profile);

  // Stable across all of this user's cover-letter calls, so it rides the Agent
  // SDK's auto-cached system prompt. Per-job inputs (the tailored resume, the
  // JD, the optional directive) live in the user prompt below.
  const systemPrompt = `${COVER_LETTER_SYSTEM_PROMPT}

CANDIDATE PROFILE (the source of truth for everything you write):
${JSON.stringify(trimmedProfile)}`;

  const resumeBlock = body.tailoredResume
    ? `TAILORED RESUME (curated for this specific job; use as the primary cue for what to emphasize):\n${body.tailoredResume}\n\n`
    : '';

  const jdBlock = `JOB POSTING:
Title: ${body.job.title}
Company: ${body.job.company}${body.job.location ? `\nLocation: ${body.job.location}` : ''}

${body.job.description}`;

  const directiveBlock = body.directive
    ? `\n\nDIRECTION FROM THE CANDIDATE FOR THIS LETTER:\n${body.directive}\nApply this where it is consistent with the system rules and the candidate's real history. It never overrides the no-fabrication rule.`
    : '';

  const userPrompt = `${resumeBlock}${jdBlock}${directiveBlock}\n\nNow write the cover letter body per the system rules.`;

  try {
    const { text, usage } = await invokeClaudeAgentForDocument({
      systemPrompt,
      userPrompt,
      model: modelId,
    });
    const payload: IGenerateResponse = { content: text, usage };
    return NextResponse.json(payload);
  } catch (err) {
    return agentErrorToResponse(err);
  }
}
