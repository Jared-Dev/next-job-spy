'use client';

export const REFRESH_EVENTS = {
  Profile: 'njs:local:profile-changed',
  Settings: 'njs:local:settings-changed',
  ApiKey: 'njs:local:apikey-changed',
  Jobs: 'njs:local:jobs-changed',
  Applications: 'njs:local:applications-changed',
  Artifacts: 'njs:local:artifacts-changed',
} as const;

/**
 * Cross-tab refresh fan-out. The bookmarklet import lives in a popup tab
 * (post-handoff /clip → /jobs/<id>) and mutates the DB there; an open
 * /jobs tab in another window has no way to hear about the new row
 * without a broadcast. The channel is lazy-initialized once per tab and
 * relays every event onto a local `window.dispatchEvent` so existing
 * listeners (useJobs, useArtifacts, ...) keep working unchanged.
 */
const CHANNEL_NAME = 'njs:refresh-bus';

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (typeof BroadcastChannel === 'undefined') return null;
  const w = window as Window & { __njsRefreshChannel?: BroadcastChannel };
  if (!w.__njsRefreshChannel) {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.onmessage = (e) => {
      if (typeof e.data === 'string') {
        window.dispatchEvent(new Event(e.data));
      }
    };
    w.__njsRefreshChannel = ch;
  }
  return w.__njsRefreshChannel;
}

export function emitRefresh(event: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(event));
  getChannel()?.postMessage(event);
}

export function useRefreshListener(
  event: string,
  callback: () => void,
): () => void {
  // Returns a deregister fn; intended to be wired via useEffect from the caller
  if (typeof window === 'undefined') return () => {};
  // Ensure the cross-tab channel listener is alive in tabs that only
  // listen (e.g. an idle /jobs tab waiting for a bookmarklet import).
  getChannel();
  window.addEventListener(event, callback);
  return () => window.removeEventListener(event, callback);
}

// Eager bootstrap so the channel listener exists everywhere this module
// loads, not just where `useRefreshListener` is called. Several hooks
// (e.g. useJobs) attach `window.addEventListener` directly and never
// touch `getChannel`; without this they'd silently miss every cross-tab
// broadcast.
if (typeof window !== 'undefined') {
  getChannel();
}
