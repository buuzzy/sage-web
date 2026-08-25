/**
 * User-scoped paths (logical, display-only)
 *
 * Web 模式下这些是给 agent / UI 展示用的占位路径
 * （~/.sage/users/{uid}/sessions/…），不对应本地文件系统。
 */

/**
 * Supabase user id 是 UUID。为了防注入，只接受合法 UUID 形态。
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ~/.sage/users/{uid}/sessions
 */
export async function getUserSessionsDir(uid: string): Promise<string> {
  if (!uid || !UUID_RE.test(uid)) {
    throw new Error(`[user-scoped-paths] invalid uid: ${uid}`);
  }
  return `~/.sage/users/${uid}/sessions`;
}
