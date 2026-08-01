/**
 * Server-side conversation reconstruction.
 *
 * When the client cannot send conversation history (e.g., IndexedDB corruption,
 * cross-device session resume before sync completes), the agent route handlers
 * call this to rebuild ConversationMessage[] from Supabase messages table.
 *
 * This is a fallback path — the primary path is always client-side
 * buildConversationHistory() which has richer message type handling.
 */

import { getServiceSupabase } from '@/shared/supabase/client';

import type { ConversationMessage } from '@/shared/types/agent';

const DATA_TOOL_PREFIXES = [
  'minishare__daily',
  'minishare__daily_basic',
  'minishare__fina_indicator',
  'minishare__income',
  'minishare__balancesheet',
  'minishare__cashflow',
  'minishare__stock_basic',
];

const TEXT_TOOL_LIMIT = 800;
const DATA_TOOL_LIMIT = 3000;
const MAX_TURNS = 50;

function truncateToolOutput(toolName: string, output: string): string {
  const isDataTool = DATA_TOOL_PREFIXES.some(
    (p) => toolName.startsWith(p) || toolName.includes(p)
  );
  const limit = isDataTool ? DATA_TOOL_LIMIT : TEXT_TOOL_LIMIT;
  if (output.length <= limit) return output;
  return output.slice(0, limit) + '...';
}

export async function reconstructConversation(
  taskId: string,
  userId: string
): Promise<ConversationMessage[]> {
  if (!taskId || !userId) return [];

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('messages')
    .select('type, content, tool_name, tool_output, tool_use_id')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error || !data || data.length === 0) return [];

  const history: ConversationMessage[] = [];
  let currentAssistantContent = '';
  const pendingToolNames = new Map<string, string>();

  for (const row of data) {
    if (row.type === 'user') {
      if (currentAssistantContent) {
        history.push({
          role: 'assistant',
          content: currentAssistantContent.trim(),
        });
        currentAssistantContent = '';
      }
      history.push({ role: 'user', content: row.content || '' });
    } else if (row.type === 'text' || row.type === 'result') {
      currentAssistantContent += (row.content || '') + '\n';
    } else if (row.type === 'tool_use') {
      const toolId = row.tool_use_id || `tool_${Date.now()}`;
      if (row.tool_name) pendingToolNames.set(toolId, row.tool_name);
      currentAssistantContent += `[Used tool: ${row.tool_name}]\n`;
    } else if (row.type === 'tool_result') {
      const toolName =
        (row.tool_use_id && pendingToolNames.get(row.tool_use_id)) ||
        row.tool_name ||
        'tool';
      const output = row.tool_output || '';
      if (output) {
        const truncated = truncateToolOutput(toolName, output);
        currentAssistantContent += `[${toolName} result]: ${truncated}\n`;
      }
    }
  }

  if (currentAssistantContent) {
    history.push({
      role: 'assistant',
      content: currentAssistantContent.trim(),
    });
  }

  const maxMessages = MAX_TURNS * 2;
  if (history.length > maxMessages) {
    return history.slice(-maxMessages);
  }

  return history;
}
