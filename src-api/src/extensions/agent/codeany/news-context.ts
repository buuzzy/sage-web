/**
 * 背景资讯卡（2026-09-22）。
 *
 * 目的：回答"近期事件"类问题时，事件是否存在、发生在哪天必须来自资讯，
 * 而不是模型训练记忆（2026-09-22 实测两轮同题，一轮查资讯答对 9/17 加息，
 * 一轮没查、凭记忆答"在降息"）。靠提示词约束"必须查"是软约束，本模块把
 * 宏观要闻摘要变成每轮常驻背景——模型不需要"想到去搜"，事件背景已在眼前。
 *
 * 实现：服务端调 minishare MCP 的 news_context 工具（宏观要闻摘要），
 * 小时级进程内缓存；同步读 + 过期后台刷新，任何失败降级为不注入
 * （fail-open，绝不阻塞回答主流程）。标的维度的资讯由 MCP 侧在行情
 * 工具输出中直接附带（见 tushare_MCP tools/corpus/news_context.py），
 * 两侧共同覆盖用户提出的"行情+财务+相关报道一次带齐"架构。
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('NewsContext');

const CARD_TTL_MS = 60 * 60 * 1000; // 1h

interface CardCache {
  fetchedAt: number;
  card: string | null;
}

let cache: CardCache | null = null;
let refreshing: Promise<void> | null = null;

async function fetchMacroCard(): Promise<string | null> {
  const url = process.env.MINISHARE_MCP_URL;
  if (!url) return null;
  const client = new Client({ name: 'sage-news-context', version: '1.0.0' });
  try {
    await client.connect(new SSEClientTransport(new URL(url)));
    const res = await client.callTool({
      name: 'news_context',
      arguments: { symbols: '', macro_days: 7 },
    });
    const parts = Array.isArray(res?.content)
      ? (res.content as Array<{ type: string; text?: string }>)
          .filter((c) => c.type === 'text' && c.text)
          .map((c) => c.text as string)
      : [];
    const text = parts.join('\n').trim();
    if (!text || text.startsWith('资讯上下文暂不可用')) return null;
    return text;
  } catch (e) {
    logger.warn(`[NewsContext] macro card fetch failed: ${e instanceof Error ? e.message : e}`);
    return null;
  } finally {
    try {
      await client.close();
    } catch {
      /* ignore */
    }
  }
}

async function refresh(): Promise<void> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const card = await fetchMacroCard();
      cache = { fetchedAt: Date.now(), card };
      if (card) logger.info('[NewsContext] macro card refreshed');
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/**
 * 同步获取当前背景卡（供 buildSdkOptions 的同步路径使用）。
 * 缓存新鲜直接返回；过期则触发后台刷新并返回旧值（可能为 null）。
 * 首轮冷启动可能拿不到卡片——此时回答纪律中"事件须查资讯"的
 * 软约束仍生效，且行情工具自带的相关资讯段不受影响。
 */
export function getMacroNewsCard(): string | null {
  const now = Date.now();
  if (!cache || now - cache.fetchedAt > CARD_TTL_MS) {
    void refresh(); // 后台刷新，不阻塞
  }
  return cache?.card ?? null;
}

// 服务启动即预取一次，尽量让首个用户回合就带着背景卡
if (process.env.MINISHARE_MCP_URL) {
  void refresh();
}
