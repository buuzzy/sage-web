// Stub type declarations for removed Tauri packages.
// These prevent TypeScript errors on dynamic imports that are
// guarded by isTauri() checks and never reached in web mode.
declare module '@tauri-apps/api/path' {
  export function appConfigDir(): Promise<string>;
  export function downloadDir(): Promise<string>;
  export function homeDir(): Promise<string>;
  export function sep(): string;
}
declare module '@tauri-apps/plugin-fs' {
  export function readFile(p: string): Promise<Uint8Array>;
  export function stat(p: string): Promise<{ size: number }>;
  export function writeFile(p: string, d: Uint8Array): Promise<void>;
  export function writeTextFile(p: string, d: string): Promise<void>;
  export function readTextFile(p: string): Promise<string>;
  export function mkdir(p: string, opts?: { recursive?: boolean }): Promise<void>;
  export function exists(p: string): Promise<boolean>;
  export function remove(p: string, opts?: { recursive?: boolean }): Promise<void>;
  export function readDir(p: string): Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean }>>;
}
declare module '@tauri-apps/plugin-opener' {
  export function openUrl(url: string): Promise<void>;
  export function openPath(path: string): Promise<void>;
}
declare module '@tauri-apps/plugin-shell' {
  export function open(path: string): Promise<void>;
}
declare module '@tauri-apps/plugin-sql' {
  export default class Sqlite {
    static load(connStr: string): Promise<Sqlite>;
    close(): Promise<void>;
    execute(sql: string, params?: unknown[]): Promise<void>;
    select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  }
}
declare module '@tauri-apps/api/webview' {
  export function getCurrentWebview(): {
    onDragDropEvent(cb: (e: unknown) => void): Promise<() => void>;
  };
}
declare module '@tauri-apps/api/window' {
  export function getCurrentWindow(): {
    setTheme(theme: string | null): Promise<void>;
  };
}
