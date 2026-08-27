/**
 * Supabase service-role client (cached).
 *
 * Mirrors sage-api/src/shared/supabase/client.ts. The service role bypasses
 * RLS, which is required here because the dashboard reads across all users
 * (profiles / code_redemptions / user_behavior). This is an internal admin
 * tool — the ADMIN_TOKEN bearer gate is the sole access control.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      '[ops-dashboard] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. Set them in .env or Railway variables.',
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}