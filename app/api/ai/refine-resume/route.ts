import { NextResponse } from 'next/server';
import { z } from 'zod';

import { agentErrorToResponse } from '@/lib/ai/agentErrorToResponse';
import { invokeClaudeAgentForDocument } from '@/lib/ai/invokeClaudeAgentForDocument';
import { parseJsonFromAgent } from '@/lib/ai/parseJsonFromAgent';
import { REFINE_SYSTEM_PROMPT_PREFIX } from '@/lib/ai/prompts';
import { trimProfileForGeneration } from '@/lib/ai/trimProfileForGeneration';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import type { IGenerateResponse } from '@/lib/ai/types/IGenerateResponse';
import { RefineResumeRequestSchema } from '@/lib/ai/types/IRefineResumeRequest';
import { RESUME_OUTPUT_SPEC } from '@/lib/resume/resumeOutputSpec';
import { getTemplate } from '@/lib/resume/templates';
import { ResumeDocumentSchema } from '@/lib/resume/types/IResumeDocument';

export async function POST(request: Request) {
  let body: z.infer<typeof RefineResumeRequestSchema>;
  try {
    body = RefineResumeRequestSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const modelId = body.model ?? EAnthropicModel.Sonnet46;
  const template = getTemplate(body.templateId);
  const trimmedProfile = trimProfileForGeneration(body.profile);

  // Stable across refines for this user + template, so it rides the Agent
  // SDK's auto-cached system prompt. The base resume to revise and the
  // refinement instruction live in the user prompt below.
  const systemPrompt = `${REFINE_SYSTEM_PROMPT_PREFIX}

Template guidance:
${template.systemPrompt}

${RESUME_OUTPUT_SPEC}

CANDIDATE PROFILE (the source of truth for everything you write):
${JSON.stringify(trimmedProfile)}`;

  const jdBlock = `JOB POSTING:
Title: ${body.job.title}
Company: ${body.job.company}${body.job.location ? `\nLocation: ${body.job.location}` : ''}

${body.job.description}`;

  const userPrompt = `${jdBlock}

CURRENT TAILORED RESUME (JSON to revise):
${body.baseContent}

INSTRUCTION:
${body.instruction}

Now produce the revised resume as JSON per the system rules.`;

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
