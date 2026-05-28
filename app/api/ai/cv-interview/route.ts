import 'server-only';

import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { trimProfileForGeneration } from '@/lib/ai/trimProfileForGeneration';
import { CV_INTERVIEWER_SYSTEM_PROMPT } from '@/lib/cv/systemPrompts';
import { CvInterviewMessageSchema } from '@/lib/cv/types/ICvInterviewMessage';
import { ProfileSchema } from '@/lib/storage/types/IProfile';

/**
 * Streaming cover-letter interview chat. The client posts the running
 * transcript and (optionally) the user's latest message; the server streams
 * Claude's next turn back as plain UTF-8 text deltas (no SSE framing, the
 * body is the assistant's reply, character by character).
 *
 * Opener turn: when the transcript is empty and there is no user message,
 * the interviewer fires the first turn proactively. The system prompt has
 * explicit opener instructions; the profile (passed below) seeds the angle.
 *
 * The client owns persistence: when the stream completes it writes the
 * updated transcript back to the profile via the adapter. Keeping the server
 * stateless matches the rest of the project's AI routes.
 */

const RequestSchema = z.object({
  /** Conversation so far. Each entry is `{ role, content, at }`. */
  transcript: z.array(CvInterviewMessageSchema).default([]),
  /**
   * The candidate's latest message. Empty string when triggering the opener
   * (transcript empty + no message) lets the interviewer go first.
   */
  message: z.string().max(4000).default(''),
  /** Profile context, used so the interviewer can pick an angle. */
  profile: ProfileSchema.optional(),
});

function firstNameOf(fullName: string | undefined): string {
  if (!fullName) return 'there';
  const trimmed = fullName.trim().split(/\s+/)[0] ?? '';
  return trimmed.length > 0 ? trimmed : 'there';
}

export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid body';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const trimmedProfile = body.profile
    ? trimProfileForGeneration(body.profile)
    : undefined;
  const candidateName = firstNameOf(body.profile?.fullName);
  const isOpener =
    body.transcript.length === 0 && body.message.trim().length === 0;

  const transcriptBlock = body.transcript.length
    ? body.transcript
        .map((m) => (m.role === 'user' ? `Candidate: ${m.content}` : `You: ${m.content}`))
        .join('\n\n')
    : '';

  const systemPrompt = `${CV_INTERVIEWER_SYSTEM_PROMPT}

CANDIDATE FIRST NAME: ${candidateName}

CANDIDATE PROFILE (use this to find an angle when opening, and to probe specifics during the interview):
${trimmedProfile ? JSON.stringify(trimmedProfile) : '(no profile yet)'}`;

  const userPrompt = isOpener
    ? `This is the start of the conversation. The candidate has not said anything yet. Fire the first turn following the "How to open" rules in your system prompt. Use the CANDIDATE PROFILE to pick a specific opening probe. Keep the whole thing readable: short greeting, the why, the reassurance, the off-ramp, then ONE concrete opening question.`
    : `You are mid-conversation with the candidate. Below is the conversation so far. Respond as the interviewer with your next turn.

TRANSCRIPT:
${transcriptBlock}

Candidate: ${body.message}

Your next turn:`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let q: ReturnType<typeof query>;
      try {
        q = query({
          prompt: userPrompt,
          options: {
            systemPrompt,
            includePartialMessages: true,
            // Conversation, not reasoning. Adaptive thinking on a chat turn
            // burns tokens with no quality gain.
            thinking: { type: 'disabled' },
            tools: [],
            cwd: process.cwd(),
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not start interview';
        controller.enqueue(encoder.encode(`\n\n[error: ${msg}]`));
        controller.close();
        return;
      }

      try {
        for await (const msg of q) {
          if (msg.type === 'stream_event') {
            const event = msg.event;
            if (
              event.type === 'content_block_delta' &&
              'delta' in event &&
              event.delta &&
              'type' in event.delta &&
              event.delta.type === 'text_delta' &&
              typeof event.delta.text === 'string'
            ) {
              if (event.delta.text.length > 0) {
                controller.enqueue(encoder.encode(event.delta.text));
              }
            }
          } else if (msg.type === 'assistant' && msg.error) {
            const human =
              msg.error === 'rate_limit'
                ? 'Claude subscription rate limit reached. Try again later, or paste an API key in Settings.'
                : msg.error === 'authentication_failed' ||
                    msg.error === 'oauth_org_not_allowed'
                  ? 'Claude Code is not authenticated. Run `claude login` in a terminal.'
                  : `Claude error: ${msg.error}`;
            controller.enqueue(encoder.encode(`\n\n[error: ${human}]`));
          } else if (msg.type === 'result') {
            break;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Stream failed';
        controller.enqueue(encoder.encode(`\n\n[error: ${message}]`));
      } finally {
        try {
          q.close();
        } catch {
          // already closed
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}
