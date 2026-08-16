/**
 * Task Events Store
 *
 * 内存缓存 Agent 执行过程中产生的所有 SSE 事件。
 * 用途：当 iOS 客户端切后台导致 SSE 流中断后，
 * 回到前台时通过 GET /agent/task/:taskId/events?after=<seq> 补偿缺失事件。
 *
 * 设计决策：
 * - 使用内存 Map 而非 Supabase（避免每个 SSE 事件都写数据库）
 * - 带 TTL 自动清理（默认 10 分钟后删除，防止内存泄漏）
 * - 每个事件带自增 seq 序号，客户端只需记住最后收到的 seq
 *
 * 未来可选：热数据内存 + 冷数据写 Supabase（用于跨 deploy 恢复）
 */

export interface StoredEvent {
  seq: number;
  timestamp: number;
  data: unknown; // SSE event payload
}

interface TaskEventBuffer {
  taskId: string;
  ownerId: string;
  events: StoredEvent[];
  createdAt: number;
  isComplete: boolean; // agent 执行完毕后标记为 true
}

// 内存存储
const store = new Map<string, TaskEventBuffer>();

function storeKey(taskId: string, ownerId: string): string {
  return `${ownerId}:${taskId}`;
}

// 配置
const MAX_AGE_MS = 10 * 60 * 1000; // 10 分钟后自动清理
const CLEANUP_INTERVAL_MS = 60 * 1000; // 每分钟检查一次

// 自动清理定时器
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, buffer] of store) {
    if (now - buffer.createdAt > MAX_AGE_MS) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref?.();

/**
 * 初始化一个 task 的事件缓冲区
 */
export function initTaskBuffer(taskId: string, ownerId = 'local'): void {
  const key = storeKey(taskId, ownerId);
  if (!store.has(key)) {
    store.set(key, {
      taskId,
      ownerId,
      events: [],
      createdAt: Date.now(),
      isComplete: false,
    });
  }
}

/**
 * 追加一个事件到 task 缓冲区
 */
export function appendEvent(
  taskId: string,
  data: unknown,
  ownerId = 'local'
): number {
  const key = storeKey(taskId, ownerId);
  let buffer = store.get(key);
  if (!buffer) {
    initTaskBuffer(taskId, ownerId);
    buffer = store.get(key)!;
  }
  const seq = buffer.events.length;
  buffer.events.push({
    seq,
    timestamp: Date.now(),
    data,
  });
  return seq;
}

/**
 * 标记 task 执行完毕
 */
export function markTaskComplete(taskId: string, ownerId = 'local'): void {
  const buffer = store.get(storeKey(taskId, ownerId));
  if (buffer) {
    buffer.isComplete = true;
  }
}

/**
 * 获取 task 的事件（支持 after seq 过滤）
 * @param taskId - 任务 ID
 * @param afterSeq - 返回 seq > afterSeq 的事件（-1 返回全部）
 */
export function getEvents(
  taskId: string,
  afterSeq = -1,
  ownerId?: string
): { events: StoredEvent[]; isComplete: boolean } | null {
  const buffer = store.get(storeKey(taskId, ownerId ?? 'local'));
  if (!buffer) return null;
  if (ownerId && buffer.ownerId !== ownerId) return null;

  const events = afterSeq < 0
    ? buffer.events
    : buffer.events.filter(e => e.seq > afterSeq);

  return {
    events,
    isComplete: buffer.isComplete,
  };
}

/**
 * 检查 task 是否存在
 */
export function hasTask(taskId: string, ownerId?: string): boolean {
  const buffer = store.get(storeKey(taskId, ownerId ?? 'local'));
  return !!buffer && (!ownerId || buffer.ownerId === ownerId);
}

/**
 * 获取 task 状态
 */
export function getTaskStatus(
  taskId: string,
  ownerId?: string
): { exists: boolean; eventCount: number; isComplete: boolean } {
  const buffer = store.get(storeKey(taskId, ownerId ?? 'local'));
  if (!buffer) return { exists: false, eventCount: 0, isComplete: false };
  return { exists: true, eventCount: buffer.events.length, isComplete: buffer.isComplete };
}
