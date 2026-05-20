import { NextResponse } from 'next/server';
import { z } from 'zod';

import { agentErrorToResponse } from '@/lib/ai/agentErrorToResponse';
import { invokeClaudeAgent } from '@/lib/ai/invokeClaudeAgent';
import { REFINE_SYSTEM_PROMPT_PREFIX } from '@/lib/ai/prompts';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import { ERefineScope } from '@/lib/ai/types/ERefineScope';
import type { IGenerateResponse } from '@/lib/ai/types/IGenerateResponse';
import { RefineResumeRequestSchema } from '@/lib/ai/types/IRefineResumeRequest';
import { getTemplate } from '@/lib/resume/templates';

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
  const isSection = body.scope === ERefineScope.Section;

  const system = `${REFINE_SYSTEM_PROMPT_PREFIX}\n\nTemplate guidance:\n${template.systemPrompt}`;
  const sharedContext = `CANDIDATE PROFILE:\n${JSON.stringify(body.profile)}\n\nJOB POSTING:\nTitle: ${body.job.title}\nCompany: ${body.job.company}\n\n${body.job.description}`;

  const userPrompt =
    isSection && body.sectionSnippet
      ? `${sharedContext}\n\nEXISTING SECTION TO REVISE:\n${body.sectionSnippet}\n\nINSTRUCTION:\n${body.instruction}\n\nOutput: only the revised section, no surrounding resume content.`
      : `${sharedContext}\n\nCURRENT TAILORED RESUME:\n${body.baseContent}\n\nINSTRUCTION:\n${body.instruction}\n\nOutput: the complete revised resume in Markdown.`;

  try {
    const { text, usage } = await invokeClaudeAgent({
      systemPrompt: system,
      userPrompt,
      model: modelId,
    });
    const payload: IGenerateResponse = {
      content: text,
      usage,
      templateId: body.templateId,
    };
    return NextResponse.json(payload);
  } catch (err) {
    return agentErrorToResponse(err);
  }
}
