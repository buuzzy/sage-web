/**
 * Supabase Client (server-side)
 *
 * 两种 client，按调用上下文使用：
 *
 * 1. service-role client (getServiceSupabase)
 *    - 绕过 RLS，god mode
 *    - 仅在「真服务器」环境使用：Railway sage-api、CI、cron
 *    - 必须显式带 user_id 过滤，sage-api 自己负责跨用户隔离
 *
 * 2. user-scoped client (createUserScopedSupabase)
 *    - 用 anon key + 用户 JWT 创建临时 client
 *    - 受 RLS 保护，auth.uid() 自动 = 用户 id
 *    - 处理用户请求（/agent 等）时用此模式，按请求方的 JWT 圈定数据范围
 *    - 不缓存：每次请求创建新实例（避免不同用户的 JWT 串台）
 *
 * 环境变量：
 *   - SUPABASE_URL：必需（两种模式都用）
 *   - SUPABASE_ANON_KEY：user-scoped 模式必需
 *   - SUPABASE_SERVICE_ROLE_KEY：service-role 模式必需，本地 dev 缺失正常
 *
 * 加载来源：
 *   - 本地 dev：shell 环境变量（只放 URL + ANON 即可）
 *   - Railway：Railway 控制台环境变量（含 service role）
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedServiceClient: SupabaseClient | null = null;

/**
 * 返回懒初始化的 service-role Supabase client。
 * 仅在 Railway / 其它受控服务器环境调用。
 * 未配置 service role key 的环境调用会抛错。
 */
export function getServiceSupabase(): SupabaseClient {
  if (cachedServiceClient) return cachedServiceClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. ' +
        'service-role mode is server-only (Railway/CI). ' +
        'Use createUserScopedSupabase() with the user JWT instead.'
    );
  }

  cachedServiceClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log('[supabase] service_role client initialized (server context)');
  return cachedServiceClient;
}

/**
 * 用 anon key + 用户 JWT 创建一次性 supabase client。
 * sage-api 处理带用户身份的请求（如 mcp tool call）时使用：前端把当前
 * 用户的 access_token 透传过来，sage-api 用它 + anon key 创建临时 client，
 * 调 RPC 时 supabase 会自动从 JWT 解出 sub 作为 auth.uid()，让 RLS 强制
 * 过滤本人数据。
 *
 * 注意：不缓存。每次请求都创建新实例，避免不同用户的 JWT 串台。
 */
export function createUserScopedSupabase(accessToken: string): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      '[supabase] SUPABASE_URL or SUPABASE_ANON_KEY missing. ' +
        'These are required for user-scoped (anon + JWT) mode and are safe to ship in client bundles.'
    );
  }

  if (!accessToken) {
    throw new Error('[supabase] accessToken is required for user-scoped client');
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * 检查 supabase 是否已配置（不抛错）。
 * 有 URL + anon key 就视为「记忆功能可用」。
 * service role 是可选的（仅 service-role 模式需要）。
 */
export function isSupabaseConfigured(): boolean {
  const hasUrl = !!process.env.SUPABASE_URL;
  const hasAnon = !!process.env.SUPABASE_ANON_KEY;
  const hasService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  return hasUrl && (hasAnon || hasService);
}

/**
 * 当前进程是否运行在 service-role 模式（Railway 等受控服务器）。
 * 用于 MemoryProvider 选择默认实现。
 */
export function isServiceRoleAvailable(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
