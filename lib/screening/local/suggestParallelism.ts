import { ELocalModelVariant } from '@/lib/storage/types/ELocalModelVariant';

import type { IGpuCheckResult } from './gpuCheck';

/**
 * Best-effort heuristic for "how many parallel local LLM workers can
 * this machine probably handle?" Used to seed the default for the
 * Settings slider, not to constrain the user's choice.
 *
 * WebGPU doesn't expose VRAM directly, so this leans on maxBufferSize
 * as a proxy for "real GPU vs integrated potato." It will be wrong
 * for users whose browser hides adapter info (Firefox, Safari often).
 * That's fine, the slider is always available and the user can
 * override.
 */
export function suggestParallelism(
  gpu: IGpuCheckResult | null,
  variant: ELocalModelVariant,
): number {
  if (gpu === null) return 1;
  if (gpu.status === 'unsupported_browser' || gpu.status === 'no_adapter') {
    return 1;
  }
  if (gpu.status === 'capable_low') return 1;

  const maxBufferMB = gpu.maxBufferMB ?? 0;

  // capable_high path. Rule of thumb based on max single-buffer size:
  //   <  2 GB max buffer : assume modest GPU, 1 worker
  //   2-4 GB             : Stronger 1, Smaller 2
  //   >= 4 GB            : Stronger 2, Smaller 3
  if (maxBufferMB < 2000) return 1;
  if (maxBufferMB < 4000) {
    return variant === ELocalModelVariant.Stronger ? 1 : 2;
  }
  return variant === ELocalModelVariant.Stronger ? 2 : 3;
}
