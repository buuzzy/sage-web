import { getSandboxRegistry } from '@/core/sandbox/registry';
import { registerBuiltinProviders } from '@/extensions/sandbox/index';

import type {
  ISandboxProvider,
  SandboxProviderType,
} from './types.js';

/**
 * Sandbox Module
 *
 * Provides extensible sandbox functionality for isolated code execution.
 * Supports multiple providers: Codex, Claude, Native (no isolation).
 */

// Export types
export * from '@/core/sandbox/types';

// Export plugin system
export * from '@/core/sandbox/plugin';

// Export pool
export {
  SandboxPool,
  getGlobalSandboxPool,
  initGlobalSandboxPool,
  shutdownGlobalSandboxPool,
  type PooledSandbox,
  type PooledSandboxConfig,
  type PoolStats,
  type IPoolableSandboxProvider,
} from '@/core/sandbox/pool';

// Export registry
export {
  getSandboxRegistry,
  registerSandboxProvider,
  createSandboxProvider,
  getSandboxProvider,
  getAvailableSandboxProviders,
  stopAllSandboxProviders,
} from '@/core/sandbox/registry';

// Export providers
export {
  NativeProvider,
  createNativeProvider,
  nativePlugin,
  CodexProvider,
  createCodexProvider,
  codexPlugin,
  ClaudeProvider,
  createClaudeProvider,
  claudePlugin,
  builtinPlugins,
  registerBuiltinProviders,
  registerSandboxPlugin,
} from '@/extensions/sandbox/index';

// ============================================================================
// Initialization
// ============================================================================

let initialized = false;

/**
 * Initialize the sandbox module with built-in providers
 */
export async function initSandbox(): Promise<void> {
  if (initialized) {
    return;
  }

  registerBuiltinProviders();
  initialized = true;

  console.log('[Sandbox] Module initialized');
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Result of provider selection with fallback info
 */
export interface ProviderSelectionResult {
  provider: ISandboxProvider;
  usedFallback: boolean;
  fallbackReason?: string;
}

/**
 * Get the best available sandbox provider
 * Priority: Codex → Native (local)
 */
export async function getBestProvider(): Promise<ISandboxProvider> {
  const result = await getBestProviderWithInfo();
  return result.provider;
}

/**
 * Get the best available sandbox provider with fallback information
 * Priority: Codex → Native (local)
 */
export async function getBestProviderWithInfo(): Promise<ProviderSelectionResult> {
  await initSandbox();

  const registry = getSandboxRegistry();

  // 1. First try Codex (preferred)
  try {
    const codexProvider = registry.create('codex');
    console.log('[Sandbox] Checking Codex availability...');
    const isCodexAvailable = await codexProvider.isAvailable();

    if (isCodexAvailable) {
      console.log('[Sandbox] ✅ Using Codex sandbox');
      await codexProvider.init();
      return {
        provider: codexProvider,
        usedFallback: false,
      };
    } else {
      console.log('[Sandbox] Codex not available, will use fallback');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn('[Sandbox] Codex not available:', errorMsg);
  }

  // 2. Fallback to Native (local execution)
  console.log(
    '[Sandbox] ⚠️ Codex not available, falling back to Native (local) execution'
  );

  try {
    const nativeProvider = await registry.getInstance('native');
    console.log(
      '[Sandbox] ✅ Using Native sandbox (no isolation, local execution)'
    );
    return {
      provider: nativeProvider,
      usedFallback: true,
      fallbackReason: 'Codex 沙盒不可用，使用本机执行环境。',
    };
  } catch (error) {
    console.error('[Sandbox] Native provider also failed:', error);
    throw new Error(
      '无法初始化沙箱环境。Codex 和本机执行环境都不可用。\n' +
        '请检查系统环境或联系技术支持。'
    );
  }
}

/**
 * Get the current sandbox mode information
 */
export async function getSandboxInfo(): Promise<{
  available: boolean;
  provider: SandboxProviderType;
  providerName: string;
  isolation: 'vm' | 'container' | 'process' | 'none';
  message: string;
  usedFallback: boolean;
  fallbackReason?: string;
}> {
  await initSandbox();

  try {
    const { provider, usedFallback, fallbackReason } =
      await getBestProviderWithInfo();
    const caps = provider.getCapabilities();

    const isolationLabel =
      caps.isolation === 'vm'
        ? 'VM 硬件隔离'
        : caps.isolation === 'container'
          ? '容器隔离'
          : caps.isolation === 'process'
            ? '进程隔离'
            : '无隔离';

    return {
      available: true,
      provider: provider.type,
      providerName: provider.name,
      isolation: caps.isolation,
      message: `使用 ${provider.name} (${isolationLabel})`,
      usedFallback,
      fallbackReason,
    };
  } catch (error) {
    return {
      available: false,
      provider: 'native',
      providerName: 'Native',
      isolation: 'none',
      message: '沙箱环境不可用',
      usedFallback: true,
      fallbackReason: error instanceof Error ? error.message : '未知错误',
    };
  }
}
