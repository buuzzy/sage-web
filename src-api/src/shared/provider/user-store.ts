/**
 * User Provider Store (read-only)
 *
 * 读取 user_providers 表中用户已配置的 provider（Vault 解密 API Key）。
 * Web 产品已内置默认模型（MiniMax-M3），不再提供 provider CRUD 界面；
 * 此文件仅为 agent.ts / cron scheduler 保留"读取既有用户配置"的兼容路径。
 * 仅在 Railway 服务端使用（需要 service_role 访问 vault.decrypted_secrets）。
 */

import { getServiceSupabase } from '@/shared/supabase/client';

// ============================================================================
// Types
// ============================================================================

export interface UserProvider {
  id: string;
  user_id: string;
  provider_kind: string;
  display_name: string;
  api_type: 'anthropic-messages' | 'openai-completions';
  base_url: string;
  endpoint_path: string;
  models: string[];
  default_model: string | null;
  enabled: boolean;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // api_key_secret_id 不暴露给客户端
}

export interface UserProviderWithKey extends UserProvider {
  /** 明文 API Key（仅后端内部使用，从 Vault 解密） */
  api_key: string;
}

// ============================================================================
// Vault Helpers
// ============================================================================

/**
 * 从 Vault 解密获取明文 API Key
 */
async function vaultGetSecret(secretId: string): Promise<string | null> {
  const sb = getServiceSupabase();

  // 通过 vault.decrypted_secrets 视图获取明文
  const { data, error } = await sb
    .from('decrypted_secrets')
    .select('decrypted_secret')
    .eq('id', secretId)
    .single();

  if (error || !data) {
    console.warn(`[user-store] Failed to decrypt secret ${secretId}:`, error?.message);
    return null;
  }

  return data.decrypted_secret;
}

/**
 * 获取用户默认 provider（含明文 API Key，后端 Cron/Channel 用）
 */
export async function getDefaultProvider(userId: string): Promise<UserProviderWithKey | null> {
  const sb = getServiceSupabase();

  const { data, error } = await sb
    .from('user_providers')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .eq('enabled', true)
    .single();

  if (error || !data) {
    // fallback: 取第一个 enabled 的
    const { data: fallback } = await sb
      .from('user_providers')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .single();

    if (!fallback) return null;

    const apiKey = fallback.api_key_secret_id
      ? await vaultGetSecret(fallback.api_key_secret_id)
      : null;

    return {
      ...fallback,
      api_key: apiKey || '',
    } as UserProviderWithKey;
  }

  // 解密 API Key
  const apiKey = data.api_key_secret_id
    ? await vaultGetSecret(data.api_key_secret_id)
    : null;

  return {
    ...data,
    api_key: apiKey || '',
  } as UserProviderWithKey;
}
