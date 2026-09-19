/**
 * Structured history rebuild for pool cold-start.
 *
 * Agent 池 TTL/LRU 逐出后，同一会话下一轮会用 priorMessages 冷启动新 Agent。
 * 若用扁平纯文本历史（toNormalizedMessages），历史里没有任何 tool_use 结构，
 * 模型会误以为"这个会话里数据都是直接回答的"，从而跳过工具调用并编造行情
 * （2026-09-15 工具调用消失事故；与 conversation.ts 记录的 2026-08-11 模仿
 * 事故是同一根源的正反两面：结构化块安全，assistant 语音的工具叙述危险）。
 *
 * 这里从 Supabase messages 表取回结构化事件（tool_use/tool_result 含
 * tool_input/tool_output），按 Anthropic 协议组装成原生消息块，让冷启动
 * Agent 看到与原池内 Agent 一致的历史。
 */

import type {
  NormalizedContentBlock,
  NormalizedMessageParam,
} from '@codeany/open-agent-sdk';

import { getServiceSupabase } from '@/shared/supabase/client';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('HistoryRebuild');

// 与 reconstructConversation 的 MAX_TURNS 量级对齐，防止超长会话撑爆上下文
const MAX_ROWS = 120;

interface MessageRow {
  type: string;
  content: string | null;
  tool_name: string | null;
  tool_input: string | null;
  tool_output: string | null;
  tool_use_id: string | null;
}

export async function buildStructuredPriorMessages(
  taskId: string,
  userId: string
): Promise<NormalizedMessageParam[] | undefined> {
  if (!taskId || !userId) return undefined;

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('messages')
      .select(
        'type, content, tool_name, tool_input, tool_output, tool_use_id'
      )
      .eq('task_id', taskId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error || !data || data.length === 0) return undefined;

    const rows = (data as unknown as MessageRow[]).slice(-MAX_ROWS);
    const messages: NormalizedMessageParam[] = [];
    let assistantBlocks: NormalizedContentBlock[] = [];
    let userBlocks: NormalizedContentBlock[] = [];

    const flushAssistant = () => {
      if (assistantBlocks.length === 0) return;
      messages.push({ role: 'assistant', content: assistantBlocks });
      assistantBlocks = [];
    };
    const flushUser = () => {
      if (userBlocks.length === 0) return;
      messages.push({ role: 'user', content: userBlocks });
      userBlocks = [];
    };

    for (const row of rows) {
      if (row.type === 'user') {
        flushAssistant();
        flushUser();
        const text = (row.content || '').trim();
        if (text) messages.push({ role: 'user', content: text });
      } else if (row.type === 'text') {
        const text = row.content || '';
        // canvas/artifact 块是 render_chart / render_canvas 工具调用的前端
        // 投影，数据已在 tool_use/tool_result 里，重复注入只会膨胀上下文
        const trimmed = text.trim();
        if (
          trimmed.startsWith('```canvas:html') ||
          trimmed.startsWith('```artifact:')
        ) {
          continue;
        }
        if (userBlocks.length > 0) flushUser();
        if (trimmed) assistantBlocks.push({ type: 'text', text });
      } else if (row.type === 'tool_use') {
        if (userBlocks.length > 0) flushUser();
        let input: unknown = {};
        if (row.tool_input) {
          try {
            input = JSON.parse(row.tool_input);
          } catch {
            input = { raw: row.tool_input };
          }
        }
        assistantBlocks.push({
          type: 'tool_use',
          id: row.tool_use_id || `hist_${messages.length}_${assistantBlocks.length}`,
          name: row.tool_name || 'unknown_tool',
          input,
        });
      } else if (row.type === 'tool_result') {
        flushAssistant();
        userBlocks.push({
          type: 'tool_result',
          tool_use_id: row.tool_use_id || '',
          content: row.tool_output || row.content || '（工具无输出）',
        });
      }
      // result / error 等其余类型不进入模型上下文
    }
    flushAssistant();
    flushUser();

    // Anthropic 要求 tool_use 与 tool_result 严格配对，任一侧落单都会让整轮
    // 请求 400。messages 表由前端逐条异步 upsert，工具执行中途关页/断网会
    // 留下无结果的 tool_use，尾部切片也可能切开配对，这里统一剔除未配对块。
    const useIds = new Set<string>();
    const resultIds = new Set<string>();
    for (const m of messages) {
      if (!Array.isArray(m.content)) continue;
      for (const b of m.content) {
        if (b.type === 'tool_use') useIds.add(b.id);
        else if (b.type === 'tool_result') resultIds.add(b.tool_use_id);
      }
    }
    const paired: NormalizedMessageParam[] = [];
    for (const m of messages) {
      if (!Array.isArray(m.content)) {
        paired.push(m);
        continue;
      }
      const kept = m.content.filter((b) =>
        b.type === 'tool_use'
          ? resultIds.has(b.id)
          : b.type === 'tool_result'
            ? useIds.has(b.tool_use_id)
            : true
      );
      // 块被清空的整条消息（如只剩未配对 tool_use 的 assistant 轮）不再保留
      if (kept.length > 0) paired.push({ ...m, content: kept });
    }

    if (paired.length === 0) return undefined;
    logger.info(
      `[history] rebuilt ${paired.length} structured messages for task ${taskId}`
    );
    return paired;
  } catch (err) {
    logger.warn(
      '[history] structured rebuild failed, caller will fall back to flat text:',
      err
    );
    return undefined;
  }
}
