/**
 * ops-dashboard server entry.
 *
 * Loads .env, mounts /api/* behind ADMIN_TOKEN Bearer auth, and serves the
 * built Vite frontend (../web/dist) for all non-/api routes (SPA fallback).
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adminOnly } from './auth.js';
import { getAdminMetrics } from './metrics.js';
import { createInviteCode, updateInviteCode } from './codes.js';

// ─── env loading ──────────────────────────────────────────────────────────
// Node 22 native; ignored in production where vars are injected by Railway.
// .env lives at ops-dashboard/.env so dev (cwd = ops-dashboard) just works.
try {
  process.loadEnvFile();
} catch {
  // No .env file is fine in production.
}

const app = new Hono();

// ─── /api/* routes (all require ADMIN_TOKEN Bearer) ────────────────────────
app.use('/api/*', adminOnly());

app.get('/api/metrics', async (c) => {
  try {
    const m = await getAdminMetrics();
    return c.json(m);
  } catch (err) {
    console.error('[ops-dashboard] /api/metrics failed:', err);
    return c.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

app.post('/api/codes', async (c) => {
  let parsed: unknown;
  try {
    parsed = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'invalid JSON body' }, 400);
  }
  const body = (parsed ?? {}) as { max_uses?: unknown; note?: unknown };
  const max_uses = body.max_uses ?? 100;
  const note = body.note ?? null;
  if (
    typeof max_uses !== 'number' ||
    !Number.isInteger(max_uses) ||
    max_uses < 1 ||
    max_uses > 100000
  ) {
    return c.json({ ok: false, error: 'max_uses must be integer 1..100000' }, 400);
  }
  if (note !== null && typeof note !== 'string') {
    return c.json({ ok: false, error: 'note must be string or null' }, 400);
  }
  if (typeof note === 'string' && note.length > 200) {
    return c.json({ ok: false, error: 'note must be 200 chars or fewer' }, 400);
  }
  try {
    const row = await createInviteCode({ max_uses, note });
    return c.json({ ok: true, code: row });
  } catch (err) {
    console.error('[ops-dashboard] POST /api/codes failed:', err);
    return c.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

app.patch('/api/codes/:id', async (c) => {
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) {
    return c.json({ ok: false, error: 'invalid id (must be UUID)' }, 400);
  }
  let parsed: unknown;
  try {
    parsed = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'invalid JSON body' }, 400);
  }
  const body = (parsed ?? {}) as { is_active?: unknown; max_uses?: unknown };
  const patch: { is_active?: boolean; max_uses?: number } = {};
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') {
      return c.json({ ok: false, error: 'is_active must be boolean' }, 400);
    }
    patch.is_active = body.is_active;
  }
  if (body.max_uses !== undefined) {
    if (
      typeof body.max_uses !== 'number' ||
      !Number.isInteger(body.max_uses) ||
      body.max_uses < 1 ||
      body.max_uses > 100000
    ) {
      return c.json({ ok: false, error: 'max_uses must be integer 1..100000' }, 400);
    }
    patch.max_uses = body.max_uses;
  }
  if (Object.keys(patch).length === 0) {
    return c.json({ ok: false, error: 'patch is empty' }, 400);
  }
  try {
    const row = await updateInviteCode(id, patch);
    return c.json({ ok: true, code: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'NOT_FOUND') {
      return c.json({ ok: false, error: 'code not found' }, 404);
    }
    if (msg.startsWith('VALIDATION:')) {
      return c.json({ ok: false, error: msg.slice('VALIDATION:'.length).trim() }, 400);
    }
    console.error('[ops-dashboard] PATCH /api/codes/:id failed:', err);
    return c.json({ ok: false, error: msg }, 500);
  }
});

// ─── static frontend (built to ../web/dist) ───────────────────────────────
const staticDir = resolve(process.cwd(), 'web', 'dist');

app.use(
  '/assets/*',
  serveStatic({
    root: staticDir,
    rewriteRequestPath: (path) => path.replace(/^\/assets/, '/assets'),
  }),
);
app.use(
  '/*',
  serveStatic({ root: staticDir }),
);

app.get('*', async (c) => {
  try {
    const html = readFileSync(resolve(staticDir, 'index.html'), 'utf-8');
    return c.html(html);
  } catch {
    return c.text(
      'Dashboard frontend not built yet. Run `pnpm --filter ops-dashboard-web build`.',
      500,
    );
  }
});

// ─── boot ─────────────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 2027);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[ops-dashboard] listening on http://localhost:${info.port}`);
});