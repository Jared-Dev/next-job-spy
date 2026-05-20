import 'server-only';

import { getApiKeyAction } from '@/lib/storage/local/actions/settings';

/**
 * Resolves the optional Anthropic API key used as a fallback when the Claude
 * subscription (via the Claude Code CLI) is unavailable or rate-limited.
 * Reads the SQLite-stored key, falling back to the ANTHROPIC_API_KEY env var.
 */
export async function resolveApiKey(): Promise<string | null> {
  return getApiKeyAction();
}
