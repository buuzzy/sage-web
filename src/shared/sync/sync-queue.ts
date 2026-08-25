/**
 * Sync Queue — 本地→云端双写失败的持久化重试队列
 *
 * 设计要点：
 *   • 通用：支持任意 table_name × operation（'insert' | 'update' | 'delete'）
 *   • 持久化：IndexedDB，重启不丢失
 *   • 指数退避：retry_count 0/1/2/3/4/5+ → 5s/15s/45s/2m/5m/30m
 *   • 用户隔离：user_id 字段，drain 时只处理当前 bound user
 *
 * 调用方：
 *   • messages-sync.ts / 未来的 tasks-sync.ts / files-sync.ts → enqueue()
 *   • startSyncWorker() 后台 loop → drainBatch() / markDone() / markFailed()
 */

import { getCurrentBoundUid } from '@/shared/db/database';
import { uuidv7 } from 'uuidv7';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SyncOperation = 'insert' | 'update' | 'delete' | 'upsert';

export interface SyncQueueRow {
  id: string;
  user_id: string;
  table_name: string;
  operation: SyncOperation;
  payload: string; // JSON string
  retry_count: number;
  last_error: string | null;
  next_retry_at: string;
  created_at: string;
}

// ─── IndexedDB helper ────────────────────────────────────────────────────────

async function getIDB(): Promise<IDBDatabase> {
  // 复用 database.ts 已经 open 的 idb 实例
  // 通过新开 connection（IndexedDB 同名 DB 多 connection 是允许的）
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('sage');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Backoff ─────────────────────────────────────────────────────────────────

const BACKOFF_MS = [
  5_000, // 0 → 5s
  15_000, // 1 → 15s
  45_000, // 2 → 45s
  2 * 60_000, // 3 → 2m
  5 * 60_000, // 4 → 5m
  30 * 60_000, // 5+ → 30m
];

function computeNextRetryAt(retryCount: number): string {
  const delayMs = BACKOFF_MS[Math.min(retryCount, BACKOFF_MS.length - 1)];
  return new Date(Date.now() + delayMs).toISOString();
}

// ─── DAO ─────────────────────────────────────────────────────────────────────

/**
 * 入队一条同步任务。
 * payload 必须是已经"准备好上传"的对象（与云端 schema 字段一致）。
 *
 * 注意：调用方应在本地写成功后立即调用此函数；不要在 try/catch 里"如果失败再 enqueue"，
 * 因为我们的契约是"本地永远写成功；云端写靠队列保证最终一致"。
 */
export async function enqueueSync(
  tableName: string,
  operation: SyncOperation,
  payload: object
): Promise<void> {
  const userId = getCurrentBoundUid();
  if (!userId) {
    console.warn('[sync-queue] enqueue skipped: no user bound');
    return;
  }

  const row: SyncQueueRow = {
    id: uuidv7(),
    user_id: userId,
    table_name: tableName,
    operation,
    payload: JSON.stringify(payload),
    retry_count: 0,
    last_error: null,
    next_retry_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const idb = await getIDB();
  const tx = idb.transaction('sync_queue', 'readwrite');
  await idbRequest(tx.objectStore('sync_queue').add(row));
}

/**
 * 取出当前用户应被处理的队列项（next_retry_at <= now，按 created_at 升序，最多 limit 条）。
 */
export async function drainBatch(limit = 10): Promise<SyncQueueRow[]> {
  const userId = getCurrentBoundUid();
  if (!userId) return [];

  const nowISO = new Date().toISOString();

  const idb = await getIDB();
  const tx = idb.transaction('sync_queue', 'readonly');
  const all = await idbRequest<SyncQueueRow[]>(
    tx.objectStore('sync_queue').getAll()
  );
  return all
    .filter((r) => r.user_id === userId && r.next_retry_at <= nowISO)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, limit);
}

/**
 * 同步成功，从队列删除。
 */
export async function markDone(id: string): Promise<void> {
  const idb = await getIDB();
  const tx = idb.transaction('sync_queue', 'readwrite');
  await idbRequest(tx.objectStore('sync_queue').delete(id));
}

/**
 * 同步失败，更新 retry_count + next_retry_at（指数退避）。
 */
export async function markFailed(id: string, errorMsg: string): Promise<void> {
  const idb = await getIDB();
  const tx = idb.transaction('sync_queue', 'readwrite');
  const store = tx.objectStore('sync_queue');
  const row = await idbRequest<SyncQueueRow | undefined>(store.get(id));
  if (!row) return;
  row.retry_count += 1;
  row.last_error = errorMsg.slice(0, 500);
  row.next_retry_at = computeNextRetryAt(row.retry_count);
  await idbRequest(store.put(row));
}
