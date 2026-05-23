import 'server-only';

import { query } from '@anthropic-ai/claude-agent-sdk';

import type { IRawAnthropicUsage } from './types/IRawAnthropicUsage';
import type { IInvokeClaudeAgentParams } from './types/IInvokeClaudeAgentParams';
import type { IInvokeClaudeAgentResult } from './types/IInvokeClaudeAgentResult';
import { stampUsage } from './usage';

export class ClaudeAgentRateLimitError extends Error {
  constructor() {
    super(
      'Claude subscription rate limit reached. Wait for the 5-hour window to reset, or paste an API key in Settings as a fallback.',
    );
    this.name = 'ClaudeAgentRateLimitError';
  }
}

export class ClaudeAgentAuthError extends Error {
  constructor() {
    super(
      'Claude Code is not authenticated. Open a terminal and run `claude login` to sign in with your subscription.',
    );
    this.name = 'ClaudeAgentAuthError';
  }
}

export class ClaudeAgentMissingError extends Error {
  constructor(cause?: unknown) {
    super(
      'Could not spawn the Claude Code CLI. Make sure it is installed and on your PATH (`claude --version` should work).',
    );
    this.name = 'ClaudeAgentMissingError';
    if (cause instanceof Error) this.cause = cause;
  }
}

export async function invokeClaudeAgent(
  params: IInvokeClaudeAgentParams,
): Promise<IInvokeClaudeAgentResult> {
  let q: ReturnType<typeof query>;
  try {
    q = query({
      prompt: params.userPrompt,
      options: {
        systemPrompt: params.systemPrompt,
        // Document drafting is a writing task, not a reasoning one. Adaptive
        // thinking would burn thousands of output tokens (the slow, expensive
        // ones) for no quality gain on this kind of work.
        thinking: { type: 'disabled' },
        tools: [],
        cwd: process.cwd(),
        ...(params.model ? { model: params.model } : {}),
      },
    });
  } catch (err) {
    throw new ClaudeAgentMissingError(err);
  }

  let text = '';
  let rawUsage: IRawAnthropicUsage | undefined;
  let resolvedModel = params.model ?? '';
  let resultError: string | undefined;

  try {
    for await (const msg of q) {
      if (msg.type === 'assistant' && msg.error) {
        if (msg.error === 'rate_limit') throw new ClaudeAgentRateLimitError();
        if (
          msg.error === 'authentication_failed' ||
          msg.error === 'oauth_org_not_allowed'
        ) {
          throw new ClaudeAgentAuthError();
        }
      }

      if (msg.type === 'result') {
        if (msg.subtype === 'success') {
          text = msg.result;
          const usage = msg.usage as IRawAnthropicUsage & { model?: string };
          rawUsage = {
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
            cache_creation_input_tokens: usage.cache_creation_input_tokens,
            cache_read_input_tokens: usage.cache_read_input_tokens,
          };
          const modelUsageMap = msg.modelUsage;
          if (!resolvedModel && modelUsageMap) {
            const first = Object.keys(modelUsageMap)[0];
            if (first) resolvedModel = first;
          }
        } else {
          resultError =
            'Claude Code returned an error. Check your terminal output if `claude doctor` reveals anything.';
        }
      }
    }
  } finally {
    try {
      q.close();
    } catch {
      // ignore — already closed
    }
  }

  if (resultError) throw new Error(resultError);
  if (!rawUsage) {
    throw new Error('Claude Code did not return usage info — call may have aborted.');
  }

  return { text, usage: stampUsage(resolvedModel || 'claude-subscription', rawUsage) };
}
