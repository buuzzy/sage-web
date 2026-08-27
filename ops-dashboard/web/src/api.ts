/**
 * Admin API client. Token lives in localStorage; explicit Authorization
 * header (the global fetch interceptor isn't relevant here since this app
 * has no Supabase auth — same-origin requests go straight to our Hono
 * backend).
 */

export const TOKEN_KEY = 'sage_admin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class AdminAuthError extends Error {}

// ─── Response types (mirror of ops-dashboard/src/metrics.ts) ────────────────

export interface AdminOverview {
  totalRegistered: number;
  activated: number;
  activationRate: number;
  newToday: number;
  redeemedToday: number;
  dauToday: number;
  messages7d: number;
  activeCodes: number;
}
export interface AdminCodeRow {
  id: string;
  code: string;
  note: string | null;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  lastRedeemedAt: string | null;
}
export interface DailyPoint { date: string; count: number }
export interface ActivityPoint { date: string; dau: number; messages: number }
export interface FunnelStep {
  key: 'registered' | 'redeemed' | 'first_message' | 'd1_return' | 'd7_return';
  label: string;
  count: number;
  fromPrevious: number | null;
  fromRegistered: number | null;
}
export interface CohortWeek {
  week: 0 | 1 | 2 | 3 | 4;
  active: number;
  rate: number | null;
  future: boolean;
}
export interface CohortRow {
  weekStart: string;
  size: number;
  weeks: CohortWeek[];
}
export interface AdminMetrics {
  generatedAt: string;
  timezone: 'Asia/Shanghai';
  overview: AdminOverview;
  codes: AdminCodeRow[];
  redemptionSeries: DailyPoint[];
  funnel: FunnelStep[];
  cohorts: CohortRow[];
  dailyActivity: ActivityPoint[];
  skills: Array<{ name: string; count: number }>;
  assets: Array<{ code: string; count: number }>;
  recentProfiles: Array<{
    email: string;
    displayName: string | null;
    createdAt: string;
    isActivated: boolean;
  }>;
  recentRedemptions: Array<{
    code: string;
    email: string;
    redeemedAt: string;
  }>;
}

export interface InviteCodeOut extends AdminCodeRow {}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) throw new AdminAuthError('not unlocked');
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) {
    clearToken();
    throw new AdminAuthError('令牌无效');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchMetrics(): Promise<AdminMetrics> {
  return adminFetch<AdminMetrics>('/api/metrics');
}

export async function createCode(input: { max_uses: number; note: string | null }): Promise<InviteCodeOut> {
  const res = await adminFetch<{ ok: boolean; code: InviteCodeOut }>('/api/codes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.code;
}

export async function updateCode(
  id: string,
  patch: { is_active?: boolean; max_uses?: number },
): Promise<InviteCodeOut> {
  const res = await adminFetch<{ ok: boolean; code: InviteCodeOut }>(`/api/codes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.code;
}

// ─── Date formatting (Asia/Shanghai, mirrors backend helper) ────────────────

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function formatShanghaiDateTime(iso: string): string {
  if (!iso) return '';
  const shifted = new Date(iso).getTime() + SHANGHAI_OFFSET_MS;
  return new Date(shifted).toISOString().slice(0, 16).replace('T', ' ');
}

export function formatShanghaiDate(iso: string): string {
  if (!iso) return '';
  const shifted = new Date(iso).getTime() + SHANGHAI_OFFSET_MS;
  return new Date(shifted).toISOString().slice(0, 10);
}

export function formatPct(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

export function relativeDays(iso: string): string {
  if (!iso) return '';
  const t = dayKeyShanghai(iso);
  const today = dayKeyShanghai(new Date().toISOString());
  const diff = daysBetween(today, t);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff < 7) return `${diff} 天前`;
  if (diff < 30) return `${Math.floor(diff / 7)} 周前`;
  return `${Math.floor(diff / 30)} 月前`;
}

function dayKeyShanghai(iso: string): string {
  const shifted = new Date(iso).getTime() + SHANGHAI_OFFSET_MS;
  return new Date(shifted).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((da - db) / 86_400_000);
}