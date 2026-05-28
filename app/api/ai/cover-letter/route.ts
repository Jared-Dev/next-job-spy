import { NextResponse } from 'next/server';
import { z } from 'zod';

import { agentErrorToResponse } from '@/lib/ai/agentErrorToResponse';
import { invokeClaudeAgentForDocument } from '@/lib/ai/invokeClaudeAgentForDocument';
import { parseJsonFromAgent } from '@/lib/ai/parseJsonFromAgent';
import {
  COVER_LETTER_SYSTEM_PROMPT,
  STANDARD_COVER_LETTER_SYSTEM_PROMPT,
} from '@/lib/ai/prompts';
import { trimProfileForGeneration } from '@/lib/ai/trimProfileForGeneration';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import type { IGenerateResponse } from '@/lib/ai/types/IGenerateResponse';
import { CoverLetterRequestSchema } from '@/lib/ai/types/ICoverLetterRequest';
import { ensureSigned } from '@/lib/coverLetter/ensureSigned';
import { sanitizeForSave } from '@/lib/cv/filenameSanitizer';

const CoverLetterOutputSchema = z.object({
  filename: z.string().min(1),
  body: z.string().min(1),
});

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

  // Branch the prompt by mode. `story` uses the candidate's saved vignette as
  // the spine; `standard` deliberately writes a professional letter that does
  // NOT invent a story when none was provided.
  const useStoryMode = body.mode === 'story' && Boolean(body.story);
  const baseSystem = useStoryMode
    ? COVER_LETTER_SYSTEM_PROMPT
    : STANDARD_COVER_LETTER_SYSTEM_PROMPT;

  const systemPrompt = `${baseSystem}

CANDIDATE PROFILE (the source of truth for everything you write):
${JSON.stringify(trimmedProfile)}`;

  const storyBlock = useStoryMode && body.story
    ? `STORY MATERIAL (the candidate's own pre-written vignette; use it as the spine of the letter without inventing facts or changing the specifics):
TITLE: ${body.story.title}
STORY:
${body.story.content}

`
    : '';

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

  const userPrompt = `${storyBlock}${resumeBlock}${jdBlock}${directiveBlock}\n\nNow write the cover letter per the system rules. Return ONLY the JSON object. No prose, no markdown fences.`;

  try {
    const { text, usage } = await invokeClaudeAgentForDocument({
      systemPrompt,
      userPrompt,
      model: modelId,
    });
    const parsed = parseJsonFromAgent(text, CoverLetterOutputSchema);
    // When the caller pre-picked a filename (story mode with selected
    // candidates), use it and ignore whatever the model emitted. Otherwise
    // fall back to the model's filename.
    const filename = body.filenameOverride
      ? sanitizeForSave(body.filenameOverride)
      : sanitizeForSave(parsed.filename);
    // Safety net: if the model forgot to sign off, append the candidate's
    // name as the closing line so the artifact (and any future re-render
    // from it, including clipboard copy) is always signed.
    const candidateName = body.profile.fullName?.trim() ?? '';
    const signedBody = ensureSigned(parsed.body, candidateName);
    const payload: IGenerateResponse = {
      content: signedBody,
      filename,
      usage,
    };
    return NextResponse.json(payload);
  } catch (err) {
    return agentErrorToResponse(err);
  }
}
