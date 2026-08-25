import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';

import '@/config/env';
import {
  agentRoutes,
  healthRoutes,
  internalDistillRoutes,
  mcpRoutes,
  mcpMemoryRoutes,
  personaRoutes,
  skillsRoutes,
} from '@/app/api';
import { corsMiddleware, localOnlyMiddleware } from '@/app/middleware/index.js';
import { loadConfig } from '@/config/loader.js';
import {
  initProviderManager,
  shutdownProviderManager,
} from '@/shared/provider/manager';

const app = new Hono();

// Global middleware
// Redacting request logger. hono's built-in logger() prints the full request
// URL including the query string, which leaks the Supabase access_token (a JWT
// carrying email + user UUID) and user_id on every /mcp-memory health poll.
// Log method + pathname + status + duration only.
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
});
app.use('*', corsMiddleware);

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

// Local-only feature routes (MCP server config, skills config/toggle) are not
// exposed in cloud mode — only meaningful when running locally for development.
const localFeatureGuard = async (c: Context, next: Next) => {
  if (process.env.SAGE_API_TOKEN) {
    return c.json({ error: 'Not Found' }, 404);
  }
  await next();
};

// ── Authenticated routes (cloud: service token or Supabase JWT; dev: loopback)
app.use('/agent/*', localOnlyMiddleware);
app.use('/mcp/*', localFeatureGuard, localOnlyMiddleware);
app.use('/mcp-memory/*', localOnlyMiddleware);
app.use('/persona/*', localOnlyMiddleware);
app.use('/skills/config/*', localFeatureGuard, localOnlyMiddleware);
app.use('/skills/toggle/*', localFeatureGuard, localOnlyMiddleware);
app.use('/skills/*', localOnlyMiddleware);

// Routes
app.route('/health', healthRoutes);
app.route('/agent', agentRoutes);
app.route('/mcp', mcpRoutes);
app.route('/mcp-memory', mcpMemoryRoutes);
app.route('/persona', personaRoutes);
app.route('/skills', skillsRoutes);
app.route('/internal', internalDistillRoutes);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Sage API',
    version: '0.1.1',
    endpoints: {
      health: '/health',
      agent: '/agent',
      mcp: '/mcp',
      mcpMemory: '/mcp-memory',
      persona: '/persona',
      skills: '/skills',
    },
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// Default port: 2026 for development; production (Railway) injects PORT.
const port = Number(process.env.PORT) || 2026;

// Store server instance for hot reload cleanup
let server: ServerType | null = null;

// Cleanup function
const cleanup = async () => {
  // Shutdown provider manager
  try {
    await shutdownProviderManager();
  } catch (error) {
    console.error('Error shutting down provider manager:', error);
  }

  if (server) {
    server.close();
    server = null;
  }
};

// Handle hot reload - close existing server
process.on('SIGTERM', () => cleanup());
process.on('SIGINT', () => cleanup());

// For tsx watch - handle the restart signal
if (process.env.NODE_ENV !== 'production') {
  process.on('exit', () => cleanup());
}

// Initialize and start server
async function start() {
  console.log(`🚀 Sage API starting...`);

  // Ensure ~/.sage/ directory structure and default files are in place
  // Must run before loadConfig() which may read ~/.sage/config.json
  const { ensureAppDirInitialized } = await import('@/shared/init/first-run');
  await ensureAppDirInitialized();

  // Load configuration
  await loadConfig();

  // Financial data is served via the minishare MCP server (Railway).
  // The MCP URL is configured via MINISHARE_MCP_URL env var and injected
  // by buildBuiltinMcpServers() in the agent extension.

  // Install built-in skills to ~/.sage/skills/
  const { installBuiltinSkills } = await import('@/shared/skills/loader');
  await installBuiltinSkills();

  // Register filesystem skills with SDK so the Skill tool can find them
  const { registerFilesystemSkills } = await import('@/shared/skills/register');
  await registerFilesystemSkills();

  // Pre-populate the intent-predictor cache (async skills load)
  // so the first query doesn't pay the filesystem I/O cost.
  const { loadAndCacheSkills } = await import('@/shared/skills/predictor');
  await loadAndCacheSkills();

  // Initialize provider manager
  await initProviderManager();

  // Clean up old session files (async, non-blocking)
  import('@/shared/context/session-store').then(({ cleanupOldSessions }) => {
    cleanupOldSessions(7);
  });

  // Phase 3: register background jobs (persona distill cron).
  // Registration is gated by SUPABASE_SERVICE_ROLE_KEY + MINIMAX_API_KEY —
  // hosts without them (local dev) skip registration naturally.
  const { registerBackgroundJobs } = await import('@/jobs/scheduler');
  registerBackgroundJobs();

  console.log(`🚀 Server starting on http://localhost:${port}`);

  server = serve({
    fetch: app.fetch,
    port,
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Note: Don't export default app here, as Bun will try to auto-start it with Bun.serve()
// which conflicts with our @hono/node-server serve() call
