import { NextResponse } from 'next/server';
import { z } from 'zod';

import { agentErrorToResponse } from '@/lib/ai/agentErrorToResponse';
import { invokeClaudeAgent } from '@/lib/ai/invokeClaudeAgent';
import { parseJsonFromAgent } from '@/lib/ai/parseJsonFromAgent';
import { EXTRACT_JOB_SKILLS_SYSTEM } from '@/lib/ai/prompts';
import { EAnthropicModel } from '@/lib/ai/types/EAnthropicModel';
import {
  getJobAction,
  setJobDesiredSkillsAction,
} from '@/lib/storage/local/actions/jobs';

const RequestSchema = z.object({
  jobId: z.number().int(),
  force: z.boolean().optional(),
});

const OutputSchema = z.object({
  skills: z.array(z.string().min(1)),
});

/**
 * Extracts the skills/tools/technologies a job posting calls for, so the UI
 * can prompt the candidate to fill in any they have not yet rated. Cached on
 * the job row after the first extraction — subsequent calls are free unless
 * `force` is set. Uses Haiku because this is a narrow extraction task.
 */
export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const job = await getJobAction(body.jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (job.desiredSkills && !body.force) {
    return NextResponse.json({ skills: job.desiredSkills, cached: true });
  }

  const description = job.descriptionMd?.trim();
  if (!description) {
    return NextResponse.json({ skills: [], cached: false });
  }

  const userPrompt = `JOB POSTING:
Title: ${job.title}
Company: ${job.company}${job.location ? `\nLocation: ${job.location}` : ''}

${description}

Now list the skills, tools, and technologies this posting calls for.`;

  try {
    const { text } = await invokeClaudeAgent({
      systemPrompt: EXTRACT_JOB_SKILLS_SYSTEM,
      userPrompt,
      model: EAnthropicModel.Haiku45,
    });
    const parsed = parseJsonFromAgent(text, OutputSchema);
    // Trim and dedupe while preserving order.
    const seen = new Set<string>();
    const skills: string[] = [];
    for (const raw of parsed.skills) {
      const name = raw.trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      skills.push(name);
    }
    await setJobDesiredSkillsAction(body.jobId, skills);
    return NextResponse.json({ skills, cached: false });
  } catch (err) {
    return agentErrorToResponse(err);
  }
}
