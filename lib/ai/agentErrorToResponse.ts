import 'server-only';

import { NextResponse } from 'next/server';

import {
  ClaudeAgentAuthError,
  ClaudeAgentMissingError,
  ClaudeAgentRateLimitError,
} from './invokeClaudeAgent';

export function agentErrorToResponse(err: unknown): NextResponse {
  if (err instanceof ClaudeAgentRateLimitError) {
    return NextResponse.json({ error: err.message }, { status: 429 });
  }
  if (err instanceof ClaudeAgentAuthError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof ClaudeAgentMissingError) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  const message = err instanceof Error ? err.message : 'AI call failed';
  return NextResponse.json({ error: message }, { status: 502 });
}
