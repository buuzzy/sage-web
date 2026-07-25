/**
 * Web-only runtime stub for @tauri-apps/* packages.
 *
 * Every @tauri-apps/* import in the codebase is a dynamic import guarded by
 * an isTauri() check and never reached in browser mode. This module provides
 * matching exports so Vite can statically resolve those imports without the
 * actual packages installed.
 *
 * The functions reject or return empty results — they should never be called.
 */

function unavailable(): Promise<never> {
  return Promise.reject(
    new Error('[sage-web] Tauri API called in web mode (should be unreachable)')
  );
}

// ── @tauri-apps/api/path ──────────────────────────────────────────
export const appDataDir = unavailable;
export const appConfigDir = unavailable;
export const downloadDir = unavailable;
export const homeDir = unavailable;
export const sep = (): string => '/';

// ── @tauri-apps/plugin-fs ─────────────────────────────────────────
export const exists = async (): Promise<boolean> => false;
export const readFile = unavailable;
export const writeFile = async (): Promise<void> => {};
export const mkdir = async (): Promise<void> => {};
export const stat = unavailable;
export const readTextFile = unavailable;
export const writeTextFile = async (): Promise<void> => {};
export const readDir = async (): Promise<never[]> => [];
export const remove = async (): Promise<void> => {};

// ── @tauri-apps/plugin-opener ─────────────────────────────────────
export const openUrl = async (): Promise<void> => {};
export const openPath = async (): Promise<void> => {};

// ── @tauri-apps/plugin-shell ──────────────────────────────────────
export const open = async (): Promise<void> => {};

// ── @tauri-apps/plugin-sql (default export) ───────────────────────
class TauriSqliteStub {
  static async load(): Promise<TauriSqliteStub> {
    return new TauriSqliteStub();
  }
  async close(): Promise<void> {}
  async execute(): Promise<{ rowsAffected: number }> {
    return { rowsAffected: 0 };
  }
  async select<T = Record<string, unknown>>(): Promise<T[]> {
    return [];
  }
}

export default TauriSqliteStub;
