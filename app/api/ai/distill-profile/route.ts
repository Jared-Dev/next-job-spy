import { NextResponse } from 'next/server';
import { z } from 'zod';

import { agentErrorToResponse } from '@/lib/ai/agentErrorToResponse';
import { invokeClaudeAgent } from '@/lib/ai/invokeClaudeAgent';
import { parseJsonFromAgent } from '@/lib/ai/parseJsonFromAgent';
import { DISTILL_PROFILE_SYSTEM } from '@/lib/ai/prompts';
import { DistillProfileRequestSchema } from '@/lib/ai/types/IDistillProfileRequest';
import type { IDistillProfileResult } from '@/lib/ai/types/IDistillProfileResult';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import { ProfileSchema } from '@/lib/storage/types/IProfile';

export async function POST(request: Request) {
  let body: z.infer<typeof DistillProfileRequestSchema>;
  try {
    body = DistillProfileRequestSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const { text, usage } = await invokeClaudeAgent({
      systemPrompt: DISTILL_PROFILE_SYSTEM,
      userPrompt: `CAREER DOCUMENT (Markdown):\n\n${body.markdown}`,
      model: body.model ?? EAnthropicModel.Sonnet46,
    });
    const profile = parseJsonFromAgent(text, ProfileSchema);
    const payload: IDistillProfileResult = {
      profile: { ...profile, sourceMarkdown: body.markdown },
      usage,
    };
    return NextResponse.json(payload);
  } catch (err) {
    return agentErrorToResponse(err);
  }
}
