// Agent Instance Pool — maintains long-lived SDK Agent instances per taskId.

import type { NormalizedMessageParam } from '@codeany/open-agent-sdk';

import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('AgentPool');

// TTL 默认 4 小时：金融对话用户经常中途离开几十分钟，30 分钟 TTL 曾导致
// 池内 Agent 被静默逐出，下一轮以扁平文本历史冷启动后模型不再调用工具
// （2026-09-15 事故）。可用 SAGE_AGENT_TTL_MS 覆盖。
const AGENT_TTL_MS =
  Number(process.env.SAGE_AGENT_TTL_MS) || 4 * 60 * 60 * 1000;
const MAX_POOL_SIZE = 50;

interface PoolEntry {
  agent: any;
  taskId: string;
  ownerId: string;
  lastUsed: number;
  abortController: AbortController;
}

const pool = new Map<string, PoolEntry>();
let evictionTimer: ReturnType<typeof setTimeout> | null = null;

function poolKey(ownerId: string, taskId: string): string {
  return `${ownerId}:${taskId}`;
}

function ensureEvictionTimer(): void {
  if (evictionTimer) return;
  evictionTimer = setInterval(() => {
    const now = Date.now();
    for (const [taskId, entry] of pool) {
      if (now - entry.lastUsed > AGENT_TTL_MS) {
        logger.info('[AgentPool] TTL evicting agent for ' + taskId);
        entry.abortController.abort();
        pool.delete(taskId);
      }
    }
    while (pool.size > MAX_POOL_SIZE) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, entry] of pool) {
        if (entry.lastUsed < oldestTime) {
          oldestTime = entry.lastUsed;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        const entry = pool.get(oldestKey);
        entry?.abortController.abort();
        pool.delete(oldestKey);
        logger.info('[AgentPool] LRU evicting agent for ' + oldestKey);
      }
    }
  }, 60 * 1000);
  evictionTimer.unref?.();
}

// Convert Sage ConversationMessage[] to SDK NormalizedMessageParam[].
export function toNormalizedMessages(
  conversation: Array<{ role: string; content: string }>
): NormalizedMessageParam[] {
  return conversation.map((msg) => ({
    role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: msg.content,
  }));
}

export interface GetOrCreateParams {
  taskId: string;
  ownerId: string;
  factory: () => any;
}

export async function getOrCreateAgent(
  params: GetOrCreateParams
): Promise<{ agent: any; isNew: boolean; abortController: AbortController }> {
  ensureEvictionTimer();

  const key = poolKey(params.ownerId, params.taskId);
  const existing = pool.get(key);
  if (existing) {
    existing.lastUsed = Date.now();
    logger.info('[AgentPool] Reusing agent for ' + params.taskId + ' (pool size: ' + pool.size + ')');
    return { agent: existing.agent, isNew: false, abortController: existing.abortController };
  }

  const abortController = new AbortController();
  const agent = params.factory();

  pool.set(key, {
    agent,
    taskId: params.taskId,
    ownerId: params.ownerId,
    lastUsed: Date.now(),
    abortController,
  });

  logger.info('[AgentPool] Created new agent for ' + params.taskId + ' (pool size: ' + pool.size + ')');
  return { agent, isNew: true, abortController };
}

export function hasAgent(taskId: string, ownerId: string): boolean {
  return pool.has(poolKey(ownerId, taskId));
}

export function evictAgent(taskId: string, ownerId: string): void {
  const key = poolKey(ownerId, taskId);
  const entry = pool.get(key);
  if (entry) {
    entry.abortController.abort();
    pool.delete(key);
    logger.info('[AgentPool] Manually evicted agent for ' + taskId);
  }
}
