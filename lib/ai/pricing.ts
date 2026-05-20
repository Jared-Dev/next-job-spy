import { EAnthropicModel } from './types/EAnthropicModel';
import type { IModelPricing } from './types/IModelPricing';

/**
 * USD per million tokens. Verify against https://www.anthropic.com/pricing.
 * Bump LAST_VERIFIED whenever the values are refreshed — a stale table will
 * understate or overstate user costs.
 */
export const LAST_VERIFIED = '2026-05-12';

export const PRICING: Record<EAnthropicModel, IModelPricing> = {
  [EAnthropicModel.Opus47]: {
    inputPerMTok: 15,
    cacheReadPerMTok: 1.5,
    cacheCreatePerMTok: 18.75,
    outputPerMTok: 75,
  },
  [EAnthropicModel.Sonnet46]: {
    inputPerMTok: 3,
    cacheReadPerMTok: 0.3,
    cacheCreatePerMTok: 3.75,
    outputPerMTok: 15,
  },
  [EAnthropicModel.Haiku45]: {
    inputPerMTok: 1,
    cacheReadPerMTok: 0.1,
    cacheCreatePerMTok: 1.25,
    outputPerMTok: 5,
  },
};

export function isKnownModel(model: string): model is EAnthropicModel {
  return Object.values(EAnthropicModel).includes(model as EAnthropicModel);
}

export function getPricing(model: string): IModelPricing | null {
  return isKnownModel(model) ? PRICING[model] : null;
}
