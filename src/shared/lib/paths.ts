/**
 * Path utilities for Sage
 *
 * Web mode: paths are display-only logical strings (~/.sage/…), used to
 * label artifacts and prompt the agent. No local filesystem access.
 */

// Cache for resolved paths
let cachedAppDataDir: string | null = null;

/**
 * Get the path separator for the current platform
 */
export async function getPathSeparator(): Promise<string> {
  return '/';
}

/**
 * Get the application data directory (logical, display-only)
 */
export async function getAppDataDir(): Promise<string> {
  if (!cachedAppDataDir) {
    cachedAppDataDir = '~/.sage';
  }
  return cachedAppDataDir;
}

/**
 * Get the default MCP config path
 */
export async function getMcpConfigPath(): Promise<string> {
  const appDir = await getAppDataDir();
  return `${appDir}/mcp.json`;
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
