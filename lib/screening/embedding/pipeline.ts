import 'server-only';

import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

/**
 * BGE-small-en-v1.5, ONNX-exported. 33MB, 384-dim, unit-normalized
 * embeddings via mean pooling. Stronger on retrieval benchmarks than
 * the older MiniLM at a small size increase.
 */
const MODEL_ID = 'Xenova/bge-small-en-v1.5';

/**
 * Shape of the embedding vector this project commits to. Changing this
 * means re-embedding every job and the profile, so it's deliberately
 * frozen here as a constant other modules can rely on.
 */
export const EMBEDDING_DIM = 384;

declare global {
  var __nextJobSpyEmbedPipe: FeatureExtractionPipeline | undefined;
  var __nextJobSpyEmbedPipeLoading:
    | Promise<FeatureExtractionPipeline>
    | undefined;
}

/**
 * Lazy singleton. First call triggers the ONNX download + load (a few
 * seconds); subsequent calls return the cached pipeline. Concurrent
 * callers during the first load all await the same promise.
 */
export async function getEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  if (globalThis.__nextJobSpyEmbedPipe) {
    return globalThis.__nextJobSpyEmbedPipe;
  }
  if (globalThis.__nextJobSpyEmbedPipeLoading) {
    return globalThis.__nextJobSpyEmbedPipeLoading;
  }
  const loadPromise = pipeline('feature-extraction', MODEL_ID, {
    dtype: 'fp32',
  }) as Promise<FeatureExtractionPipeline>;
  globalThis.__nextJobSpyEmbedPipeLoading = loadPromise.then((p) => {
    globalThis.__nextJobSpyEmbedPipe = p;
    globalThis.__nextJobSpyEmbedPipeLoading = undefined;
    return p;
  });
  return globalThis.__nextJobSpyEmbedPipeLoading;
}
