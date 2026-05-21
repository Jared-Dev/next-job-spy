/**
 * POST a JSON body and parse the JSON response. On a non-2xx response, throws
 * an Error carrying the server's `error` field when present.
 */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore parse failure — fall back to statusText
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}
