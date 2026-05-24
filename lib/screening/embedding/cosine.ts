/**
 * Cosine similarity between two unit-normalized Float32 vectors.
 *
 * For unit vectors cosine = dot product, so this is a single straight
 * dot pass: no norm divisions, no sqrt. The embedding pipeline
 * normalizes at extraction, so callers can rely on this fast path.
 */
export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Cosine length mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}
