import { NextResponse } from 'next/server';
import { z } from 'zod';

import { agentErrorToResponse } from '@/lib/ai/agentErrorToResponse';
import { invokeClaudeAgent } from '@/lib/ai/invokeClaudeAgent';
import { parseJsonFromAgent } from '@/lib/ai/parseJsonFromAgent';
import { FABRICATION_CHECK_SYSTEM } from '@/lib/ai/prompts';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import {
  VerificationFindingSchema,
  type IVerificationFinding,
} from '@/lib/ai/types/IVerificationFinding';
import type { IVerifyResult } from '@/lib/ai/types/IVerifyResult';
import { EVerificationMode } from '@/lib/storage/types/EVerificationMode';
import { ProfileSchema } from '@/lib/storage/types/IProfile';

const RequestSchema = z.object({
  content: z.string().min(1),
  profile: ProfileSchema,
  mode: z.nativeEnum(EVerificationMode).default(EVerificationMode.Thorough),
  crossCheckNumbers: z.boolean().default(true),
});

const OutputSchema = z.object({
  findings: z.array(VerificationFindingSchema),
});

function buildPrompt(content: string, profile: unknown): string {
  return `GENERATED CONTENT:\n${content}\n\nCANDIDATE PROFILE (the single source of truth):\n${JSON.stringify(
    profile,
  )}\n\nList every factual claim in the content that the profile does not support.`;
}

/** Numbers in the content that appear nowhere in the profile text. */
function unreferencedNumbers(content: string, profileText: string): string[] {
  const matches = content.match(/\d[\d,.]*\d|\d/g) ?? [];
  const flagged = new Set<string>();
  for (const raw of matches) {
    const bare = raw.replace(/,/g, '');
    if (bare.replace(/\D/g, '').length < 2) continue; // skip lone digits, too noisy
    if (!profileText.includes(raw) && !profileText.includes(bare)) {
      flagged.add(raw);
    }
  }
  return [...flagged];
}

async function modelCheck(
  model: EAnthropicModel,
  userPrompt: string,
): Promise<IVerificationFinding[]> {
  const { text } = await invokeClaudeAgent({
    systemPrompt: FABRICATION_CHECK_SYSTEM,
    userPrompt,
    model,
  });
  return parseJsonFromAgent(text, OutputSchema).findings;
}

export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const userPrompt = buildPrompt(body.content, body.profile);

  // Zero-token deterministic scan that runs regardless of model when enabled,
  // because even the stronger model can overlook an invented number.
  const numbersOff = body.crossCheckNumbers
    ? unreferencedNumbers(body.content, JSON.stringify(body.profile))
    : [];

  try {
    let modelFindings: IVerificationFinding[];
    let modelUsed: string;
    let escalated = false;

    if (body.mode === EVerificationMode.Fast) {
      const fast = await modelCheck(EAnthropicModel.Haiku45, userPrompt);
      if (fast.length === 0 && numbersOff.length === 0) {
        modelFindings = fast;
        modelUsed = EAnthropicModel.Haiku45;
      } else {
        // Evidence of risk: escalate to the stronger model.
        modelFindings = await modelCheck(EAnthropicModel.Sonnet46, userPrompt);
        modelUsed = EAnthropicModel.Sonnet46;
        escalated = true;
      }
    } else {
      modelFindings = await modelCheck(EAnthropicModel.Sonnet46, userPrompt);
      modelUsed = EAnthropicModel.Sonnet46;
    }

    // Surface unreferenced numbers the model didn't already call out.
    const numberFindings: IVerificationFinding[] = numbersOff
      .filter((n) => !modelFindings.some((f) => f.claim.includes(n)))
      .map((n) => ({
        claim: n,
        issue: "This number isn't in your profile, confirm it's accurate.",
      }));

    const result: IVerifyResult = {
      findings: [...modelFindings, ...numberFindings],
      escalated,
      modelUsed,
    };
    return NextResponse.json(result);
  } catch (err) {
    return agentErrorToResponse(err);
  }
}
