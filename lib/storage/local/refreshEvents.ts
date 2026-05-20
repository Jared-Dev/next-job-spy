'use client';

export const REFRESH_EVENTS = {
  Profile: 'njs:local:profile-changed',
  Settings: 'njs:local:settings-changed',
  ApiKey: 'njs:local:apikey-changed',
  Jobs: 'njs:local:jobs-changed',
  Applications: 'njs:local:applications-changed',
  Artifacts: 'njs:local:artifacts-changed',
} as const;

export function emitRefresh(event: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(event));
  }
}

export function useRefreshListener(
  event: string,
  callback: () => void,
): () => void {
  // Returns a deregister fn; intended to be wired via useEffect from the caller
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(event, callback);
  return () => window.removeEventListener(event, callback);
}
