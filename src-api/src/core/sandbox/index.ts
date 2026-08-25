import type { SandboxProviderType } from './types.js';

/**
 * Sandbox Module
 *
 * Extensible sandbox infrastructure for isolated code execution.
 * Ships with the Native provider (no isolation, direct execution).
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
  builtinPlugins,
  registerBuiltinProviders,
  registerSandboxPlugin,
} from '@/extensions/sandbox/index';

export type { SandboxProviderType };
