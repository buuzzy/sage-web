/**
 * Path utilities for Sage
 *
 * Uses ~/.sage/ as the standard data directory across all platforms.
 * This follows the Unix dotfile convention used by developer tools like:
 * - ~/.claude/ (Claude Code)
 * - ~/.npm/ (npm)
 * - ~/.docker/ (Docker)
 */

// Cache for resolved paths
let cachedAppDataDir: string | null = null;
let cachedSeparator: string | null = null;

/**
 * Check if running in Tauri environment
 */
function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

/**
 * Get the path separator for the current platform
 */
export async function getPathSeparator(): Promise<string> {
  if (cachedSeparator) {
    return cachedSeparator;
  }

  if (isTauri()) {
    try {
      const { sep } = await import('@tauri-apps/api/path');
      cachedSeparator = sep();
      return cachedSeparator;
    } catch {
      // Fallback
    }
  }

  // Default to Unix separator
  cachedSeparator = '/';
  return cachedSeparator;
}

/**
 * Get the application data directory
 * Returns ~/.sage on all platforms (using correct path separator)
 */
export async function getAppDataDir(): Promise<string> {
  if (cachedAppDataDir) {
    return cachedAppDataDir;
  }

  if (isTauri()) {
    try {
      const { homeDir, sep } = await import('@tauri-apps/api/path');
      const home = await homeDir();
      const separator = sep();
      // Remove trailing slash/backslash if present
      const homeClean =
        home.endsWith('/') || home.endsWith('\\') ? home.slice(0, -1) : home;
      cachedAppDataDir = `${homeClean}${separator}.sage`;
      return cachedAppDataDir;
    } catch (error) {
      console.warn('[Paths] Failed to get home dir:', error);
    }
  }

  // Fallback for browser mode
  cachedAppDataDir = '~/.sage';
  return cachedAppDataDir;
}

/**
 * Get the default MCP config path
 */
export async function getMcpConfigPath(): Promise<string> {
  const appDir = await getAppDataDir();
  const sep = await getPathSeparator();
  return `${appDir}${sep}mcp.json`;
}

/**
 * Get the filename from a path (cross-platform)
 * Works with both Unix (/) and Windows (\) paths
 */
export function getFileName(filePath: string): string {
  if (!filePath) return '';
  // Split on both / and \ and get the last part
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}
