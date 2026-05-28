import { NextResponse } from 'next/server';
import { z } from 'zod';

import { agentErrorToResponse } from '@/lib/ai/agentErrorToResponse';
import { invokeClaudeAgentForDocument } from '@/lib/ai/invokeClaudeAgentForDocument';
import { parseJsonFromAgent } from '@/lib/ai/parseJsonFromAgent';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import type { IUsageStamp } from '@/lib/storage/types/IUsageStamp';
import { sanitizeStem } from '@/lib/cv/filenameSanitizer';
import { CV_DISTILL_STORY_SYSTEM } from '@/lib/cv/systemPrompts';
import { CvInterviewMessageSchema } from '@/lib/cv/types/ICvInterviewMessage';

/**
 * Distill the running interview transcript into a single saveable cover-letter
 * story. Returns whether the transcript is ready for a story-driven CV, a
 * suggested title, and the distilled story text. Runs through
 * invokeClaudeAgentForDocument so the standard no-dash safety net catches any
 * dashes the model emits.
 */

const RequestSchema = z.object({
  transcript: z.array(CvInterviewMessageSchema).min(2),
  /** Optional candidate hint about angle / which story to extract. */
  directive: z.string().max(500).optional(),
});

const OutputSchema = z.object({
  ready: z.boolean(),
  title: z.string().min(1),
  story: z.string().min(1),
  missing: z.string().optional().default(''),
  filenameOptions: z.array(z.string().min(1)).default([]),
});

interface IDistillResponse {
  ready: boolean;
  title: string;
  story: string;
  missing: string;
  filenameOptions: string[];
  usage: IUsageStamp;
}

export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const transcriptBlock = body.transcript
    .map((m) =>
      m.role === 'user' ? `Candidate: ${m.content}` : `Interviewer: ${m.content}`,
    )
    .join('\n\n');

  const directiveBlock = body.directive
    ? `\n\nDIRECTION FROM THE CANDIDATE: ${body.directive}\nApply this where consistent with the system rules.`
    : '';

  const userPrompt = `INTERVIEW TRANSCRIPT:
${transcriptBlock}${directiveBlock}

Now distill this into the JSON object described in the system rules.`;

  try {
    const { text, usage } = await invokeClaudeAgentForDocument({
      systemPrompt: CV_DISTILL_STORY_SYSTEM,
      userPrompt,
      model: EAnthropicModel.Sonnet46,
    });
    const parsed = parseJsonFromAgent(text, OutputSchema);
    // Run the model's filename suggestions through the cross-OS sanitizer so
    // the same rules apply whether they came from /api/ai/cv-filenames or here.
    const filenameOptions: string[] = [];
    const seen = new Set<string>();
    for (const raw of parsed.filenameOptions ?? []) {
      const stem = sanitizeStem(raw);
      const key = stem.toLowerCase();
      if (stem.length === 0 || seen.has(key)) continue;
      seen.add(key);
      filenameOptions.push(stem);
      if (filenameOptions.length >= 6) break;
    }

    const payload: IDistillResponse = {
      ready: parsed.ready,
      title: parsed.title.trim(),
      story: parsed.story.trim(),
      missing: parsed.missing ?? '',
      filenameOptions,
      usage,
    };
    return NextResponse.json(payload);
  } catch (err) {
    return agentErrorToResponse(err);
  }
}
