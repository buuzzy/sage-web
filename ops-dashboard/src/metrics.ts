/**
 * Admin metrics aggregation.
 *
 * Reads four Supabase tables (profiles, invite_codes, code_redemptions,
 * user_behavior), aggregates them in TypeScript, and returns a single JSON
 * response the dashboard renders.
 *
 * Conventions:
 *  - Day boundaries are Asia/Shanghai (UTC+8). Use the helpers in lib/time.ts.
 *  - `user_behavior` has a 90-day rolling cleanup, so "first message ever"
 *    is really "first message in the last 90 days" — early users whose
 *    only activity predates the window under-count in the funnel. Documented
 *    limitation; safe for beta (~50 users, fresh data).
 *  - `query_preview` is deliberately NOT fetched — privacy decision; the
 *    dashboard screenshot is safe to share.
 *  - Legacy activated profiles (backfilled by invite-code migration) have
 *    is_activated=true but no code_redemptions rows. Funnel anchors on
 *    redemptions, so `overview.activated >= funnel.redeemed` is expected.
 *  - PostgREST hard cap is 1000 rows per query (db-max-rows). Use fetchAll()
 *    with .range() to paginate.
 */

import { getServiceSupabase } from './lib/supabase.js';
import { fetchAll } from './lib/fetch-all.js';
import {
  addDays,
  dayKeyShanghai,
  maskEmail,
  todayKeyShanghai,
  weekStartShanghai,
} from './lib/time.js';

// ─── Response types ─────────────────────────────────────────────────────────

export interface AdminOverview {
  totalRegistered: number;
  activated: number;
  activationRate: number; // 0..1, 0 when totalRegistered = 0
  newToday: number;
  redeemedToday: number;
  dauToday: number;
  messages7d: number;
  activeCodes: number; // isActive && usedCount < maxUses
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

export interface DailyPoint {
  date: string;
  count: number;
}

export interface ActivityPoint {
  date: string;
  dau: number;
  messages: number;
}

export interface FunnelStep {
  key: 'registered' | 'redeemed' | 'first_message' | 'd1_return' | 'd7_return';
  label: string;
  count: number;
  fromPrevious: number | null; // 0..1, null when previous=0
  fromRegistered: number | null;
}

export interface CohortWeek {
  week: 0 | 1 | 2 | 3 | 4;
  active: number;
  rate: number | null; // 0..1
  future: boolean; // window not yet elapsed
}

export interface CohortRow {
  weekStart: string; // yyyy-MM-dd (Monday)
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

// ─── Supabase row shapes (snake_case from DB) ────────────────────────────────

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  is_activated: boolean;
}

interface InviteCodeRow {
  id: string;
  code: string;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface RedemptionRow {
  id: string;
  code_id: string;
  user_id: string;
  redeemed_at: string;
  invite_codes: { code: string; note: string | null } | null;
  profiles: { email: string | null } | null;
}

interface BehaviorRow {
  user_id: string;
  ts: string;
  skill_used: string | null;
  asset_mentions: string[] | null;
}

// ─── Fetchers ───────────────────────────────────────────────────────────────

async function fetchProfiles(): Promise<ProfileRow[]> {
  const supabase = getServiceSupabase();
  return fetchAll<ProfileRow>(async (offset) => {
    const res = await supabase
      .from('profiles')
      .select('id,email,display_name,created_at,is_activated')
      .order('created_at', { ascending: false })
      .range(offset, offset + 999);
    return { data: res.data as ProfileRow[] | null, error: res.error };
  });
}

async function fetchInviteCodes(): Promise<InviteCodeRow[]> {
  const supabase = getServiceSupabase();
  return fetchAll<InviteCodeRow>(async (offset) => {
    const res = await supabase
      .from('invite_codes')
      .select('id,code,max_uses,used_count,is_active,note,created_at,updated_at')
      .order('created_at', { ascending: true })
      .range(offset, offset + 999);
    return { data: res.data as InviteCodeRow[] | null, error: res.error };
  });
}

async function fetchRedemptions(): Promise<RedemptionRow[]> {
  const supabase = getServiceSupabase();
  return fetchAll<RedemptionRow>(async (offset) => {
    const res = await supabase
      .from('code_redemptions')
      .select(
        'id,code_id,user_id,redeemed_at,invite_codes(code,note),profiles(email)',
      )
      .order('redeemed_at', { ascending: false })
      .range(offset, offset + 999);
    return { data: res.data as RedemptionRow[] | null, error: res.error };
  });
}

async function fetchBehavior(): Promise<BehaviorRow[]> {
  const supabase = getServiceSupabase();
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  return fetchAll<BehaviorRow>(async (offset) => {
    const res = await supabase
      .from('user_behavior')
      .select('user_id,ts,skill_used,asset_mentions')
      .gte('ts', since)
      .order('ts', { ascending: true })
      .range(offset, offset + 999);
    return { data: res.data as BehaviorRow[] | null, error: res.error };
  });
}

// ─── Aggregation ────────────────────────────────────────────────────────────

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const [profiles, codes, redemptions, behavior] = await Promise.all([
    fetchProfiles(),
    fetchInviteCodes(),
    fetchRedemptions(),
    fetchBehavior(),
  ]);

  const today = todayKeyShanghai();
  const days30: string[] = Array.from({ length: 30 }, (_, i) => addDays(today, -(29 - i)));

  // Per-user set of active dayKeys (in +08)
  const userActiveDays = new Map<string, Set<string>>();
  // Per-day aggregate buckets
  const dayBuckets = new Map<string, { users: Set<string>; messages: number }>();
  for (const d of days30) dayBuckets.set(d, { users: new Set(), messages: 0 });

  for (const b of behavior) {
    const day = dayKeyShanghai(b.ts);
    if (!userActiveDays.has(b.user_id)) userActiveDays.set(b.user_id, new Set());
    userActiveDays.get(b.user_id)!.add(day);
    const bucket = dayBuckets.get(day);
    if (bucket) {
      bucket.users.add(b.user_id);
      bucket.messages += 1;
    }
    // behavior older than the 30-day window still contributes to userActiveDays
    // (for cohort lookback); only the bucket count is restricted to 30d.
  }

  const dailyActivity: ActivityPoint[] = days30.map((date) => {
    const bucket = dayBuckets.get(date)!;
    return { date, dau: bucket.users.size, messages: bucket.messages };
  });

  // ── overview
  const totalRegistered = profiles.length;
  const activated = profiles.filter((p) => p.is_activated).length;
  const activationRate = totalRegistered > 0 ? activated / totalRegistered : 0;
  const newToday = profiles.filter((p) => dayKeyShanghai(p.created_at) === today).length;
  const redeemedToday = redemptions.filter(
    (r) => dayKeyShanghai(r.redeemed_at) === today,
  ).length;
  const dauToday = dailyActivity[dailyActivity.length - 1]?.dau ?? 0;
  const messages7d = dailyActivity.slice(-7).reduce((s, d) => s + d.messages, 0);

  // ── codes with lastRedeemedAt
  const codeLastRedeemed = new Map<string, string>();
  for (const r of redemptions) {
    const prev = codeLastRedeemed.get(r.code_id);
    if (!prev || r.redeemed_at > prev) codeLastRedeemed.set(r.code_id, r.redeemed_at);
  }
  const codeRows: AdminCodeRow[] = codes.map((c) => ({
    id: c.id,
    code: c.code,
    note: c.note,
    maxUses: c.max_uses,
    usedCount: c.used_count,
    isActive: c.is_active,
    createdAt: c.created_at,
    lastRedeemedAt: codeLastRedeemed.get(c.id) ?? null,
  }));
  const activeCodes = codeRows.filter((c) => c.isActive && c.usedCount < c.maxUses).length;

  // ── redemption series
  const redemptionSeries: DailyPoint[] = days30.map((date) => ({
    date,
    count: redemptions.filter((r) => dayKeyShanghai(r.redeemed_at) === date).length,
  }));

  // ── funnel
  const redeemedUserIds = new Set(redemptions.map((r) => r.user_id));
  const usersWithMessages = new Set(behavior.map((b) => b.user_id));

  // first_message 锚定在已兑换用户上：迁移回填的老用户（is_activated=true 但
  // 无兑换流水）也有行为记录，直接数 behavior 用户会导致漏斗人数倒挂。
  let firstMessage = 0;
  for (const uid of redeemedUserIds) {
    if (usersWithMessages.has(uid)) firstMessage += 1;
  }

  let d1Count = 0;
  let d7Count = 0;
  for (const r of redemptions) {
    const rDay = dayKeyShanghai(r.redeemed_at);
    const days = userActiveDays.get(r.user_id);
    if (!days) continue;
    if (days.has(addDays(rDay, 1))) d1Count += 1;
    let hit7 = false;
    for (let i = 7; i <= 13; i += 1) {
      if (days.has(addDays(rDay, i))) {
        hit7 = true;
        break;
      }
    }
    if (hit7) d7Count += 1;
  }

  const registered = totalRegistered;
  const redeemed = redeemedUserIds.size;

  const rate_ = (a: number, b: number) => (b > 0 ? a / b : null);

  const funnel: FunnelStep[] = [
    {
      key: 'registered',
      label: '注册',
      count: registered,
      fromPrevious: null,
      fromRegistered: registered > 0 ? 1 : null,
    },
    {
      key: 'redeemed',
      label: '兑换',
      count: redeemed,
      fromPrevious: rate_(redeemed, registered),
      fromRegistered: rate_(redeemed, registered),
    },
    {
      key: 'first_message',
      label: '首次提问',
      count: firstMessage,
      fromPrevious: rate_(firstMessage, redeemed),
      fromRegistered: rate_(firstMessage, registered),
    },
    {
      key: 'd1_return',
      label: '次日回访',
      count: d1Count,
      fromPrevious: rate_(d1Count, redeemed),
      fromRegistered: rate_(d1Count, registered),
    },
    {
      key: 'd7_return',
      label: '7 日留存',
      count: d7Count,
      fromPrevious: rate_(d7Count, redeemed),
      fromRegistered: rate_(d7Count, registered),
    },
  ];

  // ── cohorts
  // Set 去重：同一用户在同一周兑两个码（不同 code_id）也只计一次。
  const cohortMap = new Map<string, Set<string>>();
  for (const r of redemptions) {
    const ws = weekStartShanghai(r.redeemed_at);
    if (!cohortMap.has(ws)) cohortMap.set(ws, new Set());
    cohortMap.get(ws)!.add(r.user_id);
  }
  const sortedWeekStarts = Array.from(cohortMap.keys()).sort().reverse().slice(0, 12);
  const cohorts: CohortRow[] = sortedWeekStarts.map((weekStart) => {
    const userIds = cohortMap.get(weekStart)!;
    const size = userIds.size;
    const weeks: CohortWeek[] = ([0, 1, 2, 3, 4] as const).map((w) => {
      const startDay = addDays(weekStart, 7 * w);
      const endDay = addDays(startDay, 6);
      let active = 0;
      for (const uid of userIds) {
        const days = userActiveDays.get(uid);
        if (!days) continue;
        for (const d of days) {
          if (d >= startDay && d <= endDay) {
            active += 1;
            break;
          }
        }
      }
      const future = endDay > today;
      return { week: w, active, rate: size > 0 ? active / size : null, future };
    });
    return { weekStart, size, weeks };
  });

  // ── skills
  const skillCounts = new Map<string, number>();
  for (const b of behavior) {
    if (!b.skill_used) continue;
    skillCounts.set(b.skill_used, (skillCounts.get(b.skill_used) ?? 0) + 1);
  }
  const skills = Array.from(skillCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  // ── assets
  const assetCounts = new Map<string, number>();
  for (const b of behavior) {
    if (!b.asset_mentions) continue;
    for (const a of b.asset_mentions) {
      assetCounts.set(a, (assetCounts.get(a) ?? 0) + 1);
    }
  }
  const assets = Array.from(assetCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([code, count]) => ({ code, count }));

  // ── recent activity
  const recentProfiles = profiles.slice(0, 20).map((p) => ({
    email: maskEmail(p.email ?? ''),
    displayName: p.display_name,
    createdAt: p.created_at,
    isActivated: p.is_activated,
  }));
  const recentRedemptions = redemptions.slice(0, 20).map((r) => ({
    code: r.invite_codes?.code ?? '?',
    email: maskEmail(r.profiles?.email ?? ''),
    redeemedAt: r.redeemed_at,
  }));

  return {
    generatedAt: new Date().toISOString(),
    timezone: 'Asia/Shanghai',
    overview: {
      totalRegistered,
      activated,
      activationRate,
      newToday,
      redeemedToday,
      dauToday,
      messages7d,
      activeCodes,
    },
    codes: codeRows,
    redemptionSeries,
    funnel,
    cohorts,
    dailyActivity,
    skills,
    assets,
    recentProfiles,
    recentRedemptions,
  };
}