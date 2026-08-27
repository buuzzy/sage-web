#!/usr/bin/env node
/**
 * ops-dashboard server bundler.
 * Mirrors sage-api/scripts/bundle.mjs: bundles src/index.ts into a single CJS file.
 */
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname);

const cmd = [
  'pnpm', 'exec', 'esbuild',
  'src/index.ts',
  '--bundle',
  '--platform=node',
  '--format=cjs',
  '--target=node22',
  '--outfile=dist/bundle.cjs',
];

console.log(`[bundle] ${cmd.join(' ')}`);
execSync(cmd.join(' '), { cwd: rootDir, stdio: 'inherit' });