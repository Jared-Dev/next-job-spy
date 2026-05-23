import { NextResponse } from 'next/server';
import { z } from 'zod';

import { agentErrorToResponse } from '@/lib/ai/agentErrorToResponse';
import { invokeClaudeAgentForDocument } from '@/lib/ai/invokeClaudeAgentForDocument';
import { parseJsonFromAgent } from '@/lib/ai/parseJsonFromAgent';
import { trimProfileForGeneration } from '@/lib/ai/trimProfileForGeneration';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import type { IGenerateResponse } from '@/lib/ai/types/IGenerateResponse';
import { TailorResumeRequestSchema } from '@/lib/ai/types/ITailorResumeRequest';
import { RESUME_OUTPUT_SPEC } from '@/lib/resume/resumeOutputSpec';
import { getTemplate } from '@/lib/resume/templates';
import { ResumeDocumentSchema } from '@/lib/resume/types/IResumeDocument';

export async function POST(request: Request) {
  let body: z.infer<typeof TailorResumeRequestSchema>;
  try {
    body = TailorResumeRequestSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const modelId = body.model ?? EAnthropicModel.Sonnet46;
  const template = getTemplate(body.templateId);
  const trimmedProfile = trimProfileForGeneration(body.profile);

  // Stable across all of this user's tailor calls for the same template, so
  // the Agent SDK's auto-cached system prompt covers it. Only the JD and the
  // optional directive vary per job below.
  const systemPrompt = `${template.systemPrompt}

${RESUME_OUTPUT_SPEC}

CANDIDATE PROFILE (the source of truth for everything you write):
${JSON.stringify(trimmedProfile)}`;

  const jdBlock = `JOB POSTING:
Title: ${body.job.title}
Company: ${body.job.company}${body.job.location ? `\nLocation: ${body.job.location}` : ''}

${body.job.description}`;

  const directiveBlock = body.directive
    ? `\n\nDIRECTION FROM THE CANDIDATE FOR THIS GENERATION:\n${body.directive}\nApply this where it is consistent with the system rules and the candidate's real history. It never overrides the no-fabrication rule.`
    : '';

  const userPrompt = `${jdBlock}${directiveBlock}\n\nNow produce the tailored resume as JSON per the system rules.`;

  try {
    const { text, usage } = await invokeClaudeAgentForDocument({
      systemPrompt,
      userPrompt,
      model: modelId,
    });
    const resume = parseJsonFromAgent(text, ResumeDocumentSchema);
    const payload: IGenerateResponse = {
      content: JSON.stringify(resume),
      usage,
      templateId: body.templateId,
    };
    return NextResponse.json(payload);
  } catch (err) {
    return agentErrorToResponse(err);
  }
}
