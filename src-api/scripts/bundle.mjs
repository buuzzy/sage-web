#!/usr/bin/env node
/**
 * Custom esbuild bundle script.
 *
 * Bundles src/index.ts into a single CJS file for deployment (Railway / pkg).
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// Build the esbuild command - use pnpm exec to find the binary
const cmd = [
  'pnpm', 'exec', 'esbuild',
  'src/index.ts',
  '--bundle',
  '--platform=node',
  '--format=cjs',
  '--outfile=dist/bundle.cjs',
];

console.log(`[bundle] Running: ${cmd.join(' ')}`);

try {
  execSync(cmd.join(' '), {
    cwd: rootDir,
    stdio: 'inherit',
  });
  console.log('[bundle] Success');
} catch (err) {
  process.exit(1);
}
