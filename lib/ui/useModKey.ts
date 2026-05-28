'use client';

import { useSyncExternalStore } from 'react';

/**
 * Platform-aware label + glyph for the primary keyboard modifier. Returns
 * "Ctrl" / "Ctrl" on Windows and Linux, "Cmd" / "⌘" on macOS.
 *
 * SSR returns the non-Mac default so the markup is stable on the server; the
 * client swaps to "Cmd" after hydration if `navigator` says we're on macOS.
 * Pair with `suppressHydrationWarning` on the rendered text node to silence
 * the one-frame mismatch warning.
 */
export function useModKey(): { label: string; symbol: string; isMac: boolean } {
  const isMac = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  return isMac
    ? { label: 'Cmd', symbol: '⌘', isMac: true }
    : { label: 'Ctrl', symbol: 'Ctrl', isMac: false };
}

const subscribe = () => () => {};
const getServerSnapshot = () => false;
const getClientSnapshot = () => detectIsMac();

interface IUserAgentData {
  platform?: string;
}

function detectIsMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaData = (navigator as Navigator & { userAgentData?: IUserAgentData })
    .userAgentData;
  if (uaData?.platform) return uaData.platform === 'macOS';
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent ?? '');
}
