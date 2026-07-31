// Agent Instance Pool — maintains long-lived SDK Agent instances per taskId.

import type { NormalizedMessageParam } from '@codeany/open-agent-sdk';

import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('AgentPool');

const AGENT_TTL_MS = 30 * 60 * 1000;
const MAX_POOL_SIZE = 50;

interface PoolEntry {
  agent: any;
  taskId: string;
  lastUsed: number;
  abortController: AbortController;
}

const pool = new Map<string, PoolEntry>();
let evictionTimer: NodeJS.Timeout | null = null;

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
  factory: () => any;
}

export async function getOrCreateAgent(
  params: GetOrCreateParams
): Promise<{ agent: any; isNew: boolean; abortController: AbortController }> {
  ensureEvictionTimer();

  const existing = pool.get(params.taskId);
  if (existing) {
    existing.lastUsed = Date.now();
    logger.info('[AgentPool] Reusing agent for ' + params.taskId + ' (pool size: ' + pool.size + ')');
    return { agent: existing.agent, isNew: false, abortController: existing.abortController };
  }

  const abortController = new AbortController();
  const agent = params.factory();

  pool.set(params.taskId, {
    agent,
    taskId: params.taskId,
    lastUsed: Date.now(),
    abortController,
  });

  logger.info('[AgentPool] Created new agent for ' + params.taskId + ' (pool size: ' + pool.size + ')');
  return { agent, isNew: true, abortController };
}

export function evictAgent(taskId: string): void {
  const entry = pool.get(taskId);
  if (entry) {
    entry.abortController.abort();
    pool.delete(taskId);
    logger.info('[AgentPool] Manually evicted agent for ' + taskId);
  }
}

export function getPoolSize(): number {
  return pool.size;
}
