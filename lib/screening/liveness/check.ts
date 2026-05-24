import 'server-only';

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Cheap liveness probe against a job posting URL.
 *
 * Result semantics:
 *   true:   posting reachable (2xx/3xx final response).
 *   false:  posting confirmed gone (HTTP 404 or 410).
 *   null:   inconclusive (network error, timeout, opaque CORS-like
 *           failure on the server side). The caller should NOT mark
 *           the job expired in this case; transient failures are
 *           common and many boards redirect filled jobs to a 200
 *           landing page that we can't detect cheaply.
 *
 * We try HEAD first (no body). Falls back to GET if the server rejects
 * HEAD (405 Method Not Allowed is common on careers pages).
 */
export async function isUrlLive(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<boolean | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });
    } catch {
      return null;
    }

    if (res.status === 404 || res.status === 410) return false;
    if (res.status === 405 || res.status === 501) {
      // HEAD not supported; retry with GET.
      try {
        const get = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          redirect: 'follow',
        });
        if (get.status === 404 || get.status === 410) return false;
        return true;
      } catch {
        return null;
      }
    }
    return true;
  } finally {
    clearTimeout(timer);
  }
}
