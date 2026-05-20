import { NextResponse } from 'next/server';
import { z } from 'zod';

import { agentErrorToResponse } from '@/lib/ai/agentErrorToResponse';
import { invokeClaudeAgent } from '@/lib/ai/invokeClaudeAgent';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import type { IGenerateResponse } from '@/lib/ai/types/IGenerateResponse';
import { TailorResumeRequestSchema } from '@/lib/ai/types/ITailorResumeRequest';
import { getTemplate } from '@/lib/resume/templates';

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

  const profileBlock = `CANDIDATE PROFILE:\n${JSON.stringify(body.profile)}`;
  const jdBlock = `JOB POSTING:\nTitle: ${body.job.title}\nCompany: ${body.job.company}${
    body.job.location ? `\nLocation: ${body.job.location}` : ''
  }\n\n${body.job.description}\n\nNow produce the tailored Markdown resume per the system rules.`;

  try {
    const { text, usage } = await invokeClaudeAgent({
      systemPrompt: template.systemPrompt,
      userPrompt: `${profileBlock}\n\n${jdBlock}`,
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
