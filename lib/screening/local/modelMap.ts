import { ELocalModelVariant } from '@/lib/storage/types/ELocalModelVariant';

/**
 * Map our user-facing size choice to the WebLLM model id. We hide the
 * actual model name behind the Smaller/Stronger UI; if either id stops
 * shipping in a future WebLLM release, change the value here without
 * disturbing the surface.
 *
 * Sizes are the quantized on-device footprint (close to the download
 * size users will see) and are surfaced verbatim in the gate / settings
 * UI; keep these in sync with the copy if you swap models.
 */
export interface ILocalModelInfo {
  webllmModelId: string;
  approxDownloadMB: number;
}

export const LOCAL_MODEL_MAP: Record<ELocalModelVariant, ILocalModelInfo> = {
  [ELocalModelVariant.Smaller]: {
    // Qwen 2.5 1.5B Instruct, q4f32 quantization.
    webllmModelId: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
    approxDownloadMB: 900,
  },
  [ELocalModelVariant.Stronger]: {
    // Phi-3.5 Mini Instruct, q4f16 quantization.
    webllmModelId: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    approxDownloadMB: 2300,
  },
};

export function resolveLocalModel(variant: ELocalModelVariant): ILocalModelInfo {
  return LOCAL_MODEL_MAP[variant];
}
