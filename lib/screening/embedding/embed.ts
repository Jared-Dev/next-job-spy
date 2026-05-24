import 'server-only';

import { EMBEDDING_DIM, getEmbeddingPipeline } from './pipeline';

/**
 * Embed a string into a unit-normalized vector. Returns the raw bytes
 * (a Uint8Array view of the Float32Array buffer) for storage as a
 * SQLite BLOB. Cosine similarity for two unit vectors reduces to a dot
 * product, so we always normalize at extraction.
 */
export async function embedText(text: string): Promise<Uint8Array> {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(text, { pooling: 'mean', normalize: true });
  const data = output.data as Float32Array;
  if (data.length !== EMBEDDING_DIM) {
    throw new Error(
      `Embedding dimension mismatch: got ${data.length}, expected ${EMBEDDING_DIM}`,
    );
  }
  // Copy so we own the underlying buffer (the pipeline may reuse its own).
  const f32 = new Float32Array(data);
  return new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
}

/**
 * Reinterpret a stored BLOB as a Float32Array. SQLite returns Buffer in
 * better-sqlite3; we accept either Buffer or Uint8Array for flexibility.
 */
export function bytesToFloat32(bytes: Buffer | Uint8Array): Float32Array {
  const view = bytes instanceof Buffer ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : bytes;
  // Float32Array expects 4-byte alignment; copy to a fresh buffer to be safe.
  const aligned = new Uint8Array(view.byteLength);
  aligned.set(view);
  return new Float32Array(aligned.buffer);
}
