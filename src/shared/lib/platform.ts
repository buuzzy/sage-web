/**
 * Platform detection utilities.
 *
 * Provides unified platform detection for conditional behavior across
 * Tauri desktop and plain web environments.
 */

import { useSyncExternalStore } from 'react';

// ─── Platform Flags ─────────────────────────────────────────────────────────

/** Running inside Tauri desktop shell */
export const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Running in a plain browser (not wrapped by native shell) */
export const isWeb = !isTauri;

/** Running on a mobile-sized viewport */
export const isMobile =
  typeof window !== 'undefined' && window.innerWidth < 768;

/** Running on a desktop platform (Tauri or wide web) */
export const isDesktop = isTauri || !isMobile;

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
  return useSyncExternalStore(subscribeViewport, getViewportIsMobile, () => false);
}

// ─── Platform Enum ──────────────────────────────────────────────────────────

export type Platform = 'tauri' | 'web';

export function getPlatform(): Platform {
  if (isTauri) return 'tauri';
  return 'web';
}
