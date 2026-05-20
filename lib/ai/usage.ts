import { getPricing } from './pricing';
import type { IRawAnthropicUsage } from './types/IRawAnthropicUsage';
import type { IUsageStamp } from '@/lib/storage/types/IUsageStamp';

const M = 1_000_000;

export function computeCostUsd(
  model: string,
  inputTokens: number,
  cacheCreationInputTokens: number,
  cacheReadInputTokens: number,
  outputTokens: number,
): number {
  const pricing = getPricing(model);
  if (!pricing) return 0;
  return (
    (inputTokens * pricing.inputPerMTok) / M +
    (cacheCreationInputTokens * pricing.cacheCreatePerMTok) / M +
    (cacheReadInputTokens * pricing.cacheReadPerMTok) / M +
    (outputTokens * pricing.outputPerMTok) / M
  );
}

export function stampUsage(
  model: string,
  raw: IRawAnthropicUsage | undefined,
): IUsageStamp {
  const inputTokens = raw?.input_tokens ?? 0;
  const cacheCreationInputTokens = raw?.cache_creation_input_tokens ?? 0;
  const cacheReadInputTokens = raw?.cache_read_input_tokens ?? 0;
  const outputTokens = raw?.output_tokens ?? 0;
  return {
    model,
    inputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    outputTokens,
    costUsd: computeCostUsd(
      model,
      inputTokens,
      cacheCreationInputTokens,
      cacheReadInputTokens,
      outputTokens,
    ),
  };
}

