/**
 * Server-side conversation reconstruction.
 *
 * When the client cannot send conversation history (e.g. IndexedDB corruption,
 * cross-device session resume before sync completes), the agent route handlers
 * call this to rebuild ConversationMessage[] from Supabase messages table.
 * This is a fallback path — the primary path is always client-side
 * buildConversationHistory().
 *
 * IMPORTANT: only user messages and the assistant's FINAL text answers are
 * included. tool_use/tool_result are deliberately NOT injected as text —
 * a model that sees tool calls narrated in assistant voice ("[Used tool: X]
 * [X result]: ...") starts mimicking that format and fabricates tool output
 * in its own replies (incident 2026-08-11).
 *
 * NOTE: this flat projection is only for the reconstruct-fallback path. When
 * the agent pool cold-starts with history, extensions/agent/codeany/history.ts
 * rebuilds NATIVE tool_use/tool_result blocks from the same table instead —
 * flat text there made the model skip tools entirely and fabricate quotes
 * (incident 2026-09-15). Structured blocks are safe; assistant-voice narration
 * is what triggers mimicry.
 */

import { getServiceSupabase } from '@/shared/supabase/client';

import type { ConversationMessage } from '@/shared/types/agent';

const MAX_TURNS = 50;

export async function reconstructConversation(
  taskId: string,
  userId: string
): Promise<ConversationMessage[]> {
  if (!taskId || !userId) return [];

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('messages')
    .select('type, content')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error || !data || data.length === 0) return [];

  const history: ConversationMessage[] = [];

  for (const row of data) {
    if (row.type === 'user') {
      history.push({ role: 'user', content: row.content || '' });
    } else if (row.type === 'text' || row.type === 'result') {
      // Collapse consecutive assistant text into one turn
      const last = history[history.length - 1];
      if (last?.role === 'assistant') {
        last.content += '\n' + (row.content || '');
      } else {
        history.push({ role: 'assistant', content: row.content || '' });
      }
    }
    // tool_use / tool_result are intentionally skipped
  }

  // Drop empty assistant turns (e.g. a turn that only ran tools)
  const nonEmpty = history.filter(
    (m) => m.role === 'user' || m.content.trim().length > 0
  );

  const maxMessages = MAX_TURNS * 2;
  if (nonEmpty.length > maxMessages) {
    return nonEmpty.slice(-maxMessages);
  }

  return nonEmpty;
}
