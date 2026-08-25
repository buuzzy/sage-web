export interface BackupImportData {
  sessions?: unknown[];
  tasks?: unknown[];
  messages?: unknown[];
  files?: unknown[];
}

export interface BackupImportResult {
  sessions: number;
  tasks: number;
  messages: number;
  files: number;
}

// ─── User-scoped data binding ────────────────────────────────────────────────
//
// 本地数据存 IndexedDB（按浏览器隔离），云端双写到 Supabase。
//
// bind/unbind 时序：
//   - AuthProvider 在 getSession() resolve / SIGNED_IN / TOKEN_REFRESHED /
//     超时兜底解析 JWT 成功时调 `bindUserId(uid)`。
//   - AuthProvider 在 SIGNED_OUT / 显式登出 时调 `unbindUser()`。
//   - 切换用户（A 登出 → B 登录）：unbindUser 清空本地数据，bindUserId
//     记录新 uid，让 createMessage 等能注入 user_id。

const IDB_NAME = 'sage';
// v3: Phase 1 - messages/files 主键从 autoIncrement 改为客户端生成的 UUID v7（跨设备唯一）
//     已与用户达成共识：内测期数据丢弃，DROP 旧 store 重建
// v4: Phase 1 - 新增 sync_queue store（本地→云端双写失败的重试队列）
const IDB_VERSION = 4;

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

export function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export function nullableStr(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function nullableJsonString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

// ============ IndexedDB ============
let idb: IDBDatabase | null = null;

export async function getIndexedDB(): Promise<IDBDatabase> {
  if (idb) return idb;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onerror = () => {
      console.error('[IDB] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      idb = request.result;
      console.log('[IDB] Database opened successfully');
      resolve(idb);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;
      console.log(
        `[IDB] Upgrading database from v${oldVersion} to v${IDB_VERSION}...`
      );

      // sessions store (v2 起)
      if (!db.objectStoreNames.contains('sessions')) {
        const sessionsStore = db.createObjectStore('sessions', {
          keyPath: 'id',
        });
        sessionsStore.createIndex('created_at', 'created_at', {
          unique: false,
        });
      }

      // tasks store
      if (!db.objectStoreNames.contains('tasks')) {
        const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
        tasksStore.createIndex('created_at', 'created_at', { unique: false });
        tasksStore.createIndex('session_id', 'session_id', { unique: false });
      }

      // messages store
      // v3 破坏性变更：autoIncrement INTEGER → UUID v7 字符串
      // 老 store 的数据不兼容新主键，直接删除重建
      if (oldVersion < 3 && db.objectStoreNames.contains('messages')) {
        db.deleteObjectStore('messages');
        console.log(
          '[IDB] v3 migration: dropped old messages store (autoIncrement)'
        );
      }
      if (!db.objectStoreNames.contains('messages')) {
        const messagesStore = db.createObjectStore('messages', {
          keyPath: 'id',
        });
        messagesStore.createIndex('task_id', 'task_id', { unique: false });
        messagesStore.createIndex('user_id', 'user_id', { unique: false });
        messagesStore.createIndex('updated_at', 'updated_at', {
          unique: false,
        });
      }

      // files store - 同 messages 处理
      if (oldVersion < 3 && db.objectStoreNames.contains('files')) {
        db.deleteObjectStore('files');
        console.log(
          '[IDB] v3 migration: dropped old files store (autoIncrement)'
        );
      }
      if (!db.objectStoreNames.contains('files')) {
        const filesStore = db.createObjectStore('files', { keyPath: 'id' });
        filesStore.createIndex('task_id', 'task_id', { unique: false });
        filesStore.createIndex('user_id', 'user_id', { unique: false });
        filesStore.createIndex('updated_at', 'updated_at', { unique: false });
      }

      // sync_queue store (v4)
      if (!db.objectStoreNames.contains('sync_queue')) {
        const syncQueueStore = db.createObjectStore('sync_queue', {
          keyPath: 'id',
        });
        syncQueueStore.createIndex('next_retry_at', 'next_retry_at', {
          unique: false,
        });
        syncQueueStore.createIndex('user_id', 'user_id', { unique: false });
      }

      console.log('[IDB] Database upgraded successfully');
    };
  });
}

// Helper to promisify IDB requests
export function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export let currentUid: string | null = null;

const LAST_UID_KEY = 'sage:lastBoundUid';

/** Read the persisted uid from localStorage (survives page reload). */
function getPersistedUid(): string | null {
  try {
    return localStorage.getItem(LAST_UID_KEY);
  } catch {
    return null;
  }
}

/** Persist uid so the next page load can detect user switches. */
function persistUid(uid: string | null): void {
  try {
    if (uid) {
      localStorage.setItem(LAST_UID_KEY, uid);
    } else {
      localStorage.removeItem(LAST_UID_KEY);
    }
  } catch {
    /* ignore */
  }
}

// 监听器：供 settings 缓存失效 / UI 重新查询使用
const bindListeners = new Set<(uid: string | null) => void>();

/**
 * 订阅 user binding 变化。
 * 回调参数：新的 uid（null 表示已 unbind）。
 * 触发时机：bindUserId / unbindUser 成功完成之后。
 */
export function subscribeUserBinding(
  cb: (uid: string | null) => void
): () => void {
  bindListeners.add(cb);
  return () => {
    bindListeners.delete(cb);
  };
}

function notifyBindChange() {
  for (const cb of bindListeners) {
    try {
      cb(currentUid);
    } catch (err) {
      console.error('[DB] bind listener error:', err);
    }
  }
}

/**
 * 获取当前绑定的 user id（未绑定时为 null）。
 * 用于 useAgent 等需要推导用户作用域的地方。
 */
export function getCurrentBoundUid(): string | null {
  return currentUid;
}

/**
 * 绑定当前登录用户。
 * 幂等：若当前已绑定相同 uid，则 no-op。
 */
export async function bindUserId(uid: string): Promise<void> {
  // Compare against BOTH in-memory uid and persisted uid (localStorage)
  // so that page refresh (which resets currentUid to null) still detects
  // a user switch and clears stale IDB data.
  const prevUid = currentUid ?? getPersistedUid();
  if (prevUid && prevUid !== uid) {
    await clearAllLocalData();
  }
  currentUid = uid;
  persistUid(uid);
  notifyBindChange();
}

/**
 * Clear all local IndexedDB data stores.
 * Used when switching users to prevent data leakage between accounts.
 */
export async function clearAllLocalData(): Promise<void> {
  try {
    const db = await getIndexedDB();
    const storeNames = Array.from(db.objectStoreNames);
    const tx = db.transaction(storeNames, 'readwrite');
    for (const name of storeNames) {
      tx.objectStore(name).clear();
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    console.log('[IDB] All local stores cleared (user switch)');
  } catch (err) {
    console.warn('[IDB] Failed to clear stores:', err);
  }
}

export async function unbindUser(): Promise<void> {
  await clearAllLocalData();
  currentUid = null;
  persistUid(null);
  notifyBindChange();
}

// ============ Session Operations ============
