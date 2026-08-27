/**
 * Invite-code management endpoints: create (POST /api/codes) and
 * update (PATCH /api/codes/:id). Generated codes use 5 chars from
 * ABCDEFGHJKMNPQRSTUVWXYZ23456789 (no 0/O/1/I) for readability; insert
 * retries up to 5 times on unique-violation conflicts.
 */

import { randomInt } from 'node:crypto';
import { getServiceSupabase } from './lib/supabase.js';

const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const MAX_GENERATION_ATTEMPTS = 5;

function generateCode(): string {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    s += CODE_CHARSET[randomInt(0, CODE_CHARSET.length)];
  }
  return s;
}

export interface CreateInviteCodeInput {
  max_uses: number;
  note: string | null;
}

export interface InviteCodeOut {
  id: string;
  code: string;
  note: string | null;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  lastRedeemedAt: string | null;
}

export async function createInviteCode(input: CreateInviteCodeInput): Promise<InviteCodeOut> {
  const supabase = getServiceSupabase();
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const code = generateCode();
    const { data, error } = await supabase
      .from('invite_codes')
      .insert({
        code,
        max_uses: input.max_uses,
        note: input.note,
        is_active: true,
      })
      .select('id,code,note,max_uses,used_count,is_active,created_at')
      .single();
    if (!error && data) {
      return {
        id: data.id as string,
        code: data.code as string,
        note: (data.note as string | null) ?? null,
        maxUses: data.max_uses as number,
        usedCount: data.used_count as number,
        isActive: data.is_active as boolean,
        createdAt: data.created_at as string,
        lastRedeemedAt: null,
      };
    }
    // Postgres unique-violation SQLSTATE: 23505
    const msg = String((error as { message?: string } | null)?.message ?? '');
    if (msg.includes('23505') || msg.toLowerCase().includes('duplicate')) {
      continue;
    }
    throw new Error(`insert invite_code failed: ${msg || 'unknown'}`);
  }
  throw new Error('failed to generate unique invite code after 5 attempts');
}

export interface UpdateInviteCodeInput {
  is_active?: boolean;
  max_uses?: number;
}

export async function updateInviteCode(
  id: string,
  patch: UpdateInviteCodeInput,
): Promise<InviteCodeOut> {
  const supabase = getServiceSupabase();
  // Fetch current row so we can enforce max_uses >= used_count and return
  // a fully-hydrated shape.
  const current = await supabase
    .from('invite_codes')
    .select('id,code,note,max_uses,used_count,is_active,created_at')
    .eq('id', id)
    .maybeSingle();
  if (current.error) {
    throw new Error(`fetch invite_code failed: ${current.error.message}`);
  }
  if (!current.data) {
    // Route layer maps this to 404 via try/catch.
    throw new Error('NOT_FOUND');
  }
  if (patch.max_uses !== undefined && patch.max_uses < current.data.used_count) {
    // VALIDATION: 前缀让路由层区分 400（用户输入错）与 500（DB 故障）
    throw new Error(
      `VALIDATION: max_uses (${patch.max_uses}) cannot be less than used_count (${current.data.used_count})`,
    );
  }
  const updatePayload: Record<string, unknown> = {};
  if (patch.is_active !== undefined) updatePayload.is_active = patch.is_active;
  if (patch.max_uses !== undefined) updatePayload.max_uses = patch.max_uses;

  const updated = await supabase
    .from('invite_codes')
    .update(updatePayload)
    .eq('id', id)
    .select('id,code,note,max_uses,used_count,is_active,created_at')
    .single();
  if (updated.error || !updated.data) {
    throw new Error(`update invite_code failed: ${updated.error?.message ?? 'unknown'}`);
  }
  return {
    id: updated.data.id as string,
    code: updated.data.code as string,
    note: (updated.data.note as string | null) ?? null,
    maxUses: updated.data.max_uses as number,
    usedCount: updated.data.used_count as number,
    isActive: updated.data.is_active as boolean,
    createdAt: updated.data.created_at as string,
    lastRedeemedAt: null,
  };
}