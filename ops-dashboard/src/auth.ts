/**
 * ADMIN_TOKEN Bearer gate.
 *
 * Mirrors sage-api/src/app/api/internal-distill.ts:32-44. Unlike sage-api's
 * localOnlyMiddleware, this does NOT accept Supabase JWTs as a fallback —
 * /admin/* is service-to-service only (founder's browser with the admin
 * token). No JWT fallback is intentional.
 */
import type { Context, MiddlewareHandler } from 'hono';

export function checkAuth(req: Request): string | null {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return 'ADMIN_TOKEN env var not configured on this host';
  }
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return 'invalid or missing bearer token';
  if (match[1] !== expected) return 'invalid bearer token';
  return null;
}

export function adminOnly(): MiddlewareHandler {
  return async (c: Context, next) => {
    const err = checkAuth(c.req.raw);
    if (err) return c.json({ ok: false, error: err }, 401);
    await next();
  };
}