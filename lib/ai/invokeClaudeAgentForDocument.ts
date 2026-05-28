import 'server-only';

import { invokeClaudeAgent } from './invokeClaudeAgent';
import {
  hasForbiddenDashes,
  NO_DASHES_REWRITE_NOTE,
  NO_DASHES_RULE,
  stripForbiddenDashes,
} from './noDashes';
import type { IInvokeClaudeAgentParams } from './types/IInvokeClaudeAgentParams';
import type { IInvokeClaudeAgentResult } from './types/IInvokeClaudeAgentResult';
import { mergeUsage } from './usage';

/** How many times a dash-containing document is sent back for a re-write. */
const MAX_REWRITES = 2;

/**
 * invokeClaudeAgent for routes that have Claude *draft a document*, a resume
 * or a cover letter. Adds the no-dash punctuation rule to the system prompt,
 * then regex-checks the result; if an en/em dash slips through, the document
 * is sent back for a re-write (up to MAX_REWRITES times). Token usage is
 * accumulated across every attempt so the cost stays accurate.
 */
export async function invokeClaudeAgentForDocument(
  params: IInvokeClaudeAgentParams,
): Promise<IInvokeClaudeAgentResult> {
  const systemPrompt = `${params.systemPrompt}\n\n${NO_DASHES_RULE}`;

  let result = await invokeClaudeAgent({ ...params, systemPrompt });
  let usage = result.usage;

  for (
    let attempt = 0;
    attempt < MAX_REWRITES && hasForbiddenDashes(result.text);
    attempt += 1
  ) {
    result = await invokeClaudeAgent({
      ...params,
      systemPrompt,
      userPrompt: `${params.userPrompt}\n\n${NO_DASHES_REWRITE_NOTE}`,
    });
    usage = mergeUsage(usage, result.usage);
  }

  // Last-resort guarantee: never deliver a document with a forbidden dash,
  // even if every re-write attempt failed.
  const text = hasForbiddenDashes(result.text)
    ? stripForbiddenDashes(result.text)
    : result.text;

  return { text, usage };
}
