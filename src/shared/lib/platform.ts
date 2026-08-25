/**
 * Platform detection utilities.
 *
 * Web-only product: the only platform signal left is the viewport size
 * (mobile-sized vs desktop-sized layout).
 */

import { useSyncExternalStore } from 'react';

/** Running on a mobile-sized viewport */
export const isMobile =
  typeof window !== 'undefined' && window.innerWidth < 768;

// ─── Reactive viewport detection ────────────────────────────────────────────

const MOBILE_BREAKPOINT = 768;

function subscribeViewport(callback: () => void): () => void {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

function getViewportIsMobile(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/** Reactive hook: returns true when viewport is mobile-sized (<768px). */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeViewport,
    getViewportIsMobile,
    () => false
  );
}
