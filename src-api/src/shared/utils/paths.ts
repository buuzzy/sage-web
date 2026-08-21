/**
 * Path utilities for Sage API
 *
 * Uses ~/.sage/ as the standard data directory across all platforms.
 * Sandbox-aware: Automatically detects macOS App Store container and adapts paths.
 *
 * This follows the Unix dotfile convention used by developer tools like:
 * - ~/.claude/ (Claude Code)
 * - ~/.npm/ (npm)
 * - ~/.docker/ (Docker)
 *
 * In macOS App Store sandbox, the app directory is remapped to:
 * ~/Library/Containers/{app-id}/Data/
 */

import { existsSync, mkdirSync } from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  CONFIG_FILE_NAME,
  MCP_CONFIG_FILE_NAME,
  getAppDir as getAppDirFromConstants,
} from '@/config/constants';

/**
 * Get the application data directory
 * Returns ~/.sage on standard systems, or ~/Library/Containers/{app-id}/Data/ in MAS sandbox
 * Can be overridden by SAGE_APP_DIR environment variable
 */
export function getAppDataDir(): string {
  return getAppDirFromConstants();
}

/**
 * Get the application config directory
 * Same as app data dir for simplicity
 */
export function getConfigDir(): string {
  return getAppDataDir();
}

/**
 * Get the default config file path
 */
export function getConfigPath(): string {
  return path.join(getConfigDir(), CONFIG_FILE_NAME);
}

/**
 * Get the default MCP config path
 */
export function getMcpConfigPath(): string {
  return path.join(getConfigDir(), MCP_CONFIG_FILE_NAME);
}

/**
 * Expand ~ to home directory
 * Also handles sandbox container paths transparently
 */
export function expandPath(inputPath: string): string {
  if (inputPath.startsWith('~')) {
    return path.join(os.homedir(), inputPath.slice(1));
  }
  return inputPath;
}

// ============================================================================
// Sandbox-specific path utilities
// ============================================================================

/**
 * Get the effective app directory with sandbox awareness
 * This function combines constants and paths modules for complete sandbox handling
 */
export function getEffectiveAppDir(): string {
  const appDir = getAppDataDir();

  try {
    // Ensure directory exists
    if (!existsSync(appDir)) {
      mkdirSync(appDir, { recursive: true });
    }
  } catch (err) {
    console.warn(`[Paths] Failed to ensure app dir exists: ${appDir}`, err);
  }

  return appDir;
}
