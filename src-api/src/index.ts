import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';

import '@/config/env';
import {
  agentRoutes,
  cronRoutes,
  filesRoutes,
  healthRoutes,
  internalDistillRoutes,
  mcpRoutes,
  mcpMemoryRoutes,
  personaRoutes,
  previewRoutes,
  providersRoutes,
  sandboxRoutes,
  skillsRoutes,
} from '@/app/api';
import { corsMiddleware, localOnlyMiddleware } from '@/app/middleware/index.js';
import { loadConfig } from '@/config/loader.js';
import {
  initProviderManager,
  shutdownProviderManager,
} from '@/shared/provider/manager';
import { getPreviewManager } from '@/shared/services/preview';

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

const desktopRoutesDisabledInCloud = async (c: Context, next: Next) => {
  if (process.env.SAGE_API_TOKEN) {
    return c.json({ error: 'Not Found' }, 404);
  }
  await next();
};

// ── Execution-capable routes (authenticated) ───────────────────────────────
// These routes can execute shell commands, read/write files, invoke tools, etc.
// In cloud mode (SAGE_API_TOKEN set) access requires service-token or Supabase
// JWT auth; in local dev it is restricted to loopback callers.
app.use('/agent/*', localOnlyMiddleware);
app.use('/sandbox/*', desktopRoutesDisabledInCloud, localOnlyMiddleware);
app.use('/preview/*', desktopRoutesDisabledInCloud, localOnlyMiddleware);
app.use('/files/*', desktopRoutesDisabledInCloud, localOnlyMiddleware);
app.use('/mcp/*', desktopRoutesDisabledInCloud, localOnlyMiddleware);
app.use('/mcp-memory/*', localOnlyMiddleware);
app.use('/persona/*', localOnlyMiddleware);
app.use('/skills/config/*', desktopRoutesDisabledInCloud, localOnlyMiddleware);
app.use('/skills/toggle/*', desktopRoutesDisabledInCloud, localOnlyMiddleware);
app.use('/skills/*', localOnlyMiddleware);

// ── Management routes (authenticated: config, cron — no external access) ─
// These routes expose sensitive configuration and internal state.
// Same auth model as above: JWT/token in cloud mode, loopback in local dev.
app.use('/providers/*', desktopRoutesDisabledInCloud, localOnlyMiddleware);
app.use('/cron/*', desktopRoutesDisabledInCloud, localOnlyMiddleware);

// Routes
app.route('/health', healthRoutes);
app.route('/agent', agentRoutes);
app.route('/sandbox', sandboxRoutes);
app.route('/preview', previewRoutes);
app.route('/providers', providersRoutes);
app.route('/files', filesRoutes);
app.route('/mcp', mcpRoutes);
app.route('/mcp-memory', mcpMemoryRoutes);
app.route('/persona', personaRoutes);
app.route('/skills', skillsRoutes);
app.route('/cron', cronRoutes);
app.route('/internal', internalDistillRoutes);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Sage API',
    version: '0.1.1',
    endpoints: {
      health: '/health',
      agent: '/agent',
      sandbox: '/sandbox',
      preview: '/preview',
      providers: '/providers',
      files: '/files',
      mcp: '/mcp',
      mcpMemory: '/mcp-memory',
      skills: '/skills',
      cron: '/cron',
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
  // Shutdown cron scheduler (stops all scheduled tasks)
  try {
    const { shutdownScheduler } = await import('@/shared/cron/scheduler');
    shutdownScheduler();
  } catch (error) {
    console.error('Error shutting down cron scheduler:', error);
  }

  // Stop all preview servers
  try {
    const previewManager = getPreviewManager();
    await previewManager.stopAll();
  } catch (error) {
    console.error('Error stopping preview servers:', error);
  }

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

  // Initialize cron scheduler (loads persisted jobs, schedules enabled ones).
  // Phase 2 移除了 sys-memory-consolidation 这个内置任务；scheduler 在启动时
  // 会主动清理历史中可能残留的同名 job。
  const { initScheduler } = await import('@/shared/cron/scheduler');
  initScheduler();
  console.log('⏰ Cron scheduler initialized');

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
