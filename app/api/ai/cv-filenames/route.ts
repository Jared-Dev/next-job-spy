import { NextResponse } from 'next/server';
import { z } from 'zod';

import { agentErrorToResponse } from '@/lib/ai/agentErrorToResponse';
import { invokeClaudeAgentForDocument } from '@/lib/ai/invokeClaudeAgentForDocument';
import { parseJsonFromAgent } from '@/lib/ai/parseJsonFromAgent';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import type { IUsageStamp } from '@/lib/storage/types/IUsageStamp';
import { CV_FILENAMES_SYSTEM } from '@/lib/cv/systemPrompts';
import { sanitizeStem } from '@/lib/cv/filenameSanitizer';

/**
 * Generate clickbait-style filename candidates for a saved story. Stateless,
 * the candidate stories themselves live on the profile; this route just turns
 * one of them into 5 fresh filename suggestions on demand. The client renders
 * them as pills and persists whichever the candidate keeps.
 */

const RequestSchema = z.object({
  /** The full story text whose specifics the filenames should pull from. */
  story: z.string().min(1).max(8000),
  /** Optional story title for extra context. */
  title: z.string().max(200).optional(),
});

const OutputSchema = z.object({
  filenames: z.array(z.string().min(1)).default([]),
});

interface ICvFilenamesResponse {
  filenames: string[];
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

  const titleBlock = body.title ? `STORY TITLE: ${body.title}\n\n` : '';
  const userPrompt = `${titleBlock}STORY:
${body.story}

Now emit the JSON object described in the system rules.`;

  try {
    const { text, usage } = await invokeClaudeAgentForDocument({
      systemPrompt: CV_FILENAMES_SYSTEM,
      userPrompt,
      model: EAnthropicModel.Sonnet46,
    });
    const parsed = parseJsonFromAgent(text, OutputSchema);

    // Sanitize, dedupe (case-insensitive), cap at 5. Drop anything that fails
    // cross-OS validation rather than fudging it; the model can resample.
    const filenames: string[] = [];
    const seen = new Set<string>();
    for (const raw of parsed.filenames) {
      const stem = sanitizeStem(raw);
      const key = stem.toLowerCase();
      if (stem.length === 0 || seen.has(key)) continue;
      seen.add(key);
      filenames.push(stem);
      if (filenames.length >= 5) break;
    }

    const payload: ICvFilenamesResponse = { filenames, usage };
    return NextResponse.json(payload);
  } catch (err) {
    return agentErrorToResponse(err);
  }
}
