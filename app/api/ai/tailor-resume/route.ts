import { NextResponse } from 'next/server';
import { z } from 'zod';

import { agentErrorToResponse } from '@/lib/ai/agentErrorToResponse';
import { invokeClaudeAgentForDocument } from '@/lib/ai/invokeClaudeAgentForDocument';
import { parseJsonFromAgent } from '@/lib/ai/parseJsonFromAgent';
import { trimProfileForGeneration } from '@/lib/ai/trimProfileForGeneration';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import type { IGenerateResponse } from '@/lib/ai/types/IGenerateResponse';
import { TailorResumeRequestSchema } from '@/lib/ai/types/ITailorResumeRequest';
import { mergeUsage } from '@/lib/ai/usage';
import { enforceRoleCap } from '@/lib/resume/enforceRoleCap';
import {
  estimateRenderHeightPt,
  TWO_PAGE_BUDGET_PT,
} from '@/lib/resume/estimateRenderHeight';
import { RESUME_OUTPUT_SPEC } from '@/lib/resume/resumeOutputSpec';
import { RESUME_SYSTEM_PROMPT } from '@/lib/resume/systemPrompt';
import {
  ResumeDocumentSchema,
  type IResumeDocument,
} from '@/lib/resume/types/IResumeDocument';

const MAX_LENGTH_RETRIES = 2;

export async function POST(request: Request) {
  let body: z.infer<typeof TailorResumeRequestSchema>;
  try {
    body = TailorResumeRequestSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const modelId = body.model ?? EAnthropicModel.Sonnet46;
  const trimmedProfile = trimProfileForGeneration(body.profile);

  // Stable across all tailor calls for this user, so the Agent SDK's
  // auto-cached system prompt covers it. Only the JD and the optional
  // directive vary per job below.
  const systemPrompt = `${RESUME_SYSTEM_PROMPT}

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

  const baseUserPrompt = `${jdBlock}${directiveBlock}\n\nNow produce the tailored resume as JSON per the system rules.`;

  try {
    let resume: IResumeDocument | null = null;
    let usage = null as Awaited<ReturnType<typeof invokeClaudeAgentForDocument>>['usage'] | null;
    let userPrompt = baseUserPrompt;
    let attempt = 0;

    while (attempt <= MAX_LENGTH_RETRIES) {
      const result = await invokeClaudeAgentForDocument({
        systemPrompt,
        userPrompt,
        model: modelId,
      });
      usage = usage ? mergeUsage(usage, result.usage) : result.usage;
      const parsed = enforceRoleCap(
        parseJsonFromAgent(result.text, ResumeDocumentSchema),
      );
      const height = estimateRenderHeightPt(parsed);
      const tooLong = height > TWO_PAGE_BUDGET_PT;

      if (!tooLong || attempt === MAX_LENGTH_RETRIES) {
        resume = parsed;
        if (tooLong) {
          console.warn(
            `[njs:tailor] still ~${height}pt after ${attempt + 1} attempts (budget ${TWO_PAGE_BUDGET_PT}pt); accepting`,
          );
        }
        break;
      }

      console.log(
        `[njs:tailor] estimated ~${height}pt > ${TWO_PAGE_BUDGET_PT}pt budget; asking for a tighter pass (attempt ${attempt + 1}/${MAX_LENGTH_RETRIES})`,
      );

      // Hand back what they just produced and tell them what's too long.
      // The reprompt is specific: which sections are biggest, which roles
      // have the most bullets, so the model can target the cut.
      userPrompt = `${baseUserPrompt}

YOUR PREVIOUS OUTPUT was too long. Estimated rendered height: ~${height}pt vs. a two-page budget of ~${TWO_PAGE_BUDGET_PT}pt.

Cut more in this next pass following the priority order in the system rules:
1. Trim the lowest-signal bullets on the LEAST-recent roles first.
2. Drop "techStack" on older roles where the stack does not match the JD.
3. Shorten or drop "context" lines on older roles.
4. Move the 4th role into "earlier" and keep only three detailed roles.
5. Tighten the summary to one sentence.

PREVIOUS OUTPUT (do not echo verbatim, produce a shorter revision):
${JSON.stringify(parsed)}`;
      attempt += 1;
    }

    if (!resume || !usage) {
      throw new Error('Resume generation failed: empty result.');
    }
    const payload: IGenerateResponse = {
      content: JSON.stringify(resume),
      usage,
    };
    return NextResponse.json(payload);
  } catch (err) {
    return agentErrorToResponse(err);
  }
}
