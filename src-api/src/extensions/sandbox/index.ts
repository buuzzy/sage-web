// Import for registration
import type { SandboxPlugin } from '@/core/sandbox/plugin';
import { getSandboxRegistry } from '@/core/sandbox/registry';
import { nativePlugin } from '@/extensions/sandbox/native';

/**
 * Sandbox Providers Index
 *
 * Registers the native sandbox provider with the registry.
 */

// Export providers
export {
  NativeProvider,
  createNativeProvider,
  nativePlugin,
} from '@/extensions/sandbox/native';

/**
 * All built-in plugins
 */
export const builtinPlugins: SandboxPlugin[] = [nativePlugin];

/**
 * Register all built-in sandbox providers
 */
export function registerBuiltinProviders(): void {
  const registry = getSandboxRegistry();

  for (const plugin of builtinPlugins) {
    registry.register(plugin);
  }

  console.log(
    `[SandboxProviders] Registered built-in providers: ${builtinPlugins.map((p) => p.metadata.type).join(', ')}`
  );
}

/**
 * Register a custom sandbox plugin
 */
export function registerSandboxPlugin(plugin: SandboxPlugin): void {
  const registry = getSandboxRegistry();
  registry.register(plugin);
}
