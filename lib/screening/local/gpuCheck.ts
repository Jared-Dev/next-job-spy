/**
 * WebGPU capability detection for the local LLM stage.
 *
 * The local screen runs in a Web Worker via WebLLM, which requires
 * WebGPU. Not every browser/OS has it on by default; we want to detect
 * upfront and either surface the limitation or steer the user to a
 * smaller model.
 *
 * Safe to call only in the browser. Returns a structured verdict so the
 * UI can show specifically why the gate is unavailable.
 */
export type TGpuCheckStatus =
  | 'unsupported_browser'
  | 'no_adapter'
  | 'capable_low'
  | 'capable_high';

export interface IGpuCheckResult {
  status: TGpuCheckStatus;
  /** Human-readable reason for UI display. */
  reason: string;
  /** Estimated max single-allocation buffer in MB, if known. */
  maxBufferMB?: number;
  /** Vendor / description if the browser exposes adapter info. */
  vendor?: string;
}

/**
 * Conservative threshold for "this adapter can comfortably run Stronger
 * (~2.3GB on-device)". WebGPU allocates buffers in 256MB chunks
 * typically, but a model load needs several gigs of headroom. Adapters
 * below ~2 GB max buffer are flagged so the UI can nudge toward
 * Smaller.
 */
const STRONGER_MIN_MAX_BUFFER_BYTES = 2_000_000_000;

/**
 * Successful capability detection is cached for the lifetime of the
 * tab: the GPU isn't going to change underneath us, and re-requesting
 * an adapter immediately after a worker teardown can transient-fail
 * (the previous adapter hasn't fully released, so requestAdapter
 * returns null). The driver re-runs this check whenever settings that
 * affect worker spawning change; without the cache, every such spawn
 * risks a spurious "Local screen unavailable" banner. Failures are
 * NOT cached so a one-off error doesn't lock the user out for the
 * session.
 */
let cachedCapableResult: IGpuCheckResult | null = null;
let inFlightProbe: Promise<IGpuCheckResult> | null = null;

export async function checkWebGpuCapability(): Promise<IGpuCheckResult> {
  if (cachedCapableResult !== null) return cachedCapableResult;
  if (inFlightProbe !== null) return inFlightProbe;
  inFlightProbe = probeWebGpuCapability().then((result) => {
    if (result.status === 'capable_high' || result.status === 'capable_low') {
      cachedCapableResult = result;
    }
    inFlightProbe = null;
    return result;
  });
  return inFlightProbe;
}

async function probeWebGpuCapability(): Promise<IGpuCheckResult> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return {
      status: 'unsupported_browser',
      reason:
        'Your browser does not expose WebGPU. The local screen needs it; the embedding screen still runs on the server.',
    };
  }

  let adapter: GPUAdapter | null = null;
  try {
    adapter = await navigator.gpu.requestAdapter();
  } catch (err) {
    return {
      status: 'no_adapter',
      reason:
        err instanceof Error
          ? `WebGPU adapter request failed: ${err.message}`
          : 'WebGPU adapter request failed.',
    };
  }

  if (!adapter) {
    return {
      status: 'no_adapter',
      reason:
        'No usable GPU was found. Some setups expose WebGPU but cannot allocate an adapter (integrated GPUs with limited memory, headless contexts, etc.).',
    };
  }

  const maxBuffer = adapter.limits?.maxBufferSize;
  const maxBufferMB = maxBuffer ? Math.round(maxBuffer / 1_000_000) : undefined;

  // adapter.info is gated behind a flag in some browsers; treat
  // gracefully when missing.
  type TAdapterInfoLike = { vendor?: string; description?: string };
  const adapterInfo = (
    adapter as unknown as { info?: TAdapterInfoLike }
  ).info;
  const vendor = adapterInfo?.description || adapterInfo?.vendor;

  if (maxBuffer && maxBuffer < STRONGER_MIN_MAX_BUFFER_BYTES) {
    return {
      status: 'capable_low',
      reason:
        'WebGPU is available but the adapter has limited buffer capacity. The Smaller model will run; Stronger may fail to load.',
      maxBufferMB,
      vendor,
    };
  }

  return {
    status: 'capable_high',
    reason: 'WebGPU and a capable adapter are available.',
    maxBufferMB,
    vendor,
  };
}
