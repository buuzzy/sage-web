/**
 * Asia/Shanghai time helpers.
 *
 * All date bucketing in the dashboard uses China Standard Time (UTC+8, no DST).
 * Storing server-side as UTC ISO strings; converting at aggregation time keeps
 * day boundaries aligned to what the operator actually sees on the wall clock.
 */

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** ISO timestamp → 'yyyy-MM-dd' in Asia/Shanghai. */
export function dayKeyShanghai(iso: string): string {
  const shifted = new Date(iso).getTime() + SHANGHAI_OFFSET_MS;
  return new Date(shifted).toISOString().slice(0, 10);
}

/** Today's 'yyyy-MM-dd' in Asia/Shanghai. */
export function todayKeyShanghai(): string {
  return dayKeyShanghai(new Date().toISOString());
}

/** Add n days to a 'yyyy-MM-dd' key (treats the key as a calendar date in +08). */
export function addDays(key: string, n: number): string {
  // Parse the key as a UTC midnight date so we don't accidentally drift across DST
  // or local-time boundaries; then add n*86_400_000 ms and slice.
  const base = new Date(key + 'T00:00:00Z').getTime();
  return new Date(base + n * 86_400_000).toISOString().slice(0, 10);
}

/** Monday of the week containing the ISO timestamp, in Asia/Shanghai (yyyy-MM-dd). */
export function weekStartShanghai(iso: string): string {
  const day = dayKeyShanghai(iso);
  const d = new Date(day + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0=Sun..6=Sat; we want Monday=0
  const offsetFromMon = (dow + 6) % 7;
  return addDays(day, -offsetFromMon);
}

/** ISO timestamp → 'yyyy-MM-dd HH:mm' in Asia/Shanghai for display. */
export function formatShanghai(iso: string): string {
  const shifted = new Date(iso).getTime() + SHANGHAI_OFFSET_MS;
  return new Date(shifted).toISOString().slice(0, 16).replace('T', ' ');
}

/** 'ab***@domain' for safe display in the admin dashboard. */
export function maskEmail(email: string): string {
  if (!email) return '';
  const at = email.indexOf('@');
  const local = at === -1 ? email : email.slice(0, at);
  const domain = at === -1 ? '' : email.slice(at);
  if (local.length === 0) return '***' + domain;
  if (local.length === 1) return local + '***' + domain;
  return local.slice(0, 2) + '***' + domain;
}