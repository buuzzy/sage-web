/**
 * Conversation history builder.
 * Transforms local message array into the format expected by the Agent API.
 *
 * IMPORTANT: only user messages and the assistant's FINAL text answers are
 * included. tool_use/tool_result are deliberately NOT injected as text —
 * a model that sees tool calls narrated in assistant voice ("[Used tool: X]
 * [X result]: ...") starts mimicking that format, narrating fake tool calls
 * and echoing stale truncated data in its own replies (incident 2026-08-11).
 * Follow-ups that need exact numbers should re-query the tools instead,
 * which also returns fresher data than a truncated history dump.
 */

import { getSettings } from '@/shared/db/settings';

import type { AgentMessage, ConversationMessage } from './types';

function buildConversationHistory(
  initialPrompt: string,
  messages: AgentMessage[]
): ConversationMessage[] {
  const history: ConversationMessage[] = [];

  // Use persisted user messages whenever they exist. task.prompt can later be
  // replaced by a generated sidebar title, so it must not be treated as the
  // canonical first user message for follow-up context.
  const hasPersistedUserMessage = messages.some((msg) => msg.type === 'user');
  if (initialPrompt && !hasPersistedUserMessage) {
    history.push({ role: 'user', content: initialPrompt });
  }

  for (const msg of messages) {
    if (msg.type === 'user') {
      history.push({
        role: 'user',
        content: msg.content || '',
      });
    } else if (msg.type === 'text') {
      // Collapse consecutive assistant text into one turn
      const last = history[history.length - 1];
      if (last?.role === 'assistant') {
        last.content += '\n' + (msg.content || '');
      } else {
        history.push({ role: 'assistant', content: msg.content || '' });
      }
    }
    // tool_use / tool_result / result / error are intentionally skipped
  }

  // Drop empty assistant turns (e.g. a turn that only ran tools)
  const nonEmpty = history.filter(
    (m) => m.role === 'user' || m.content.trim().length > 0
  );

  // Apply history length limit - keep only the most recent messages
  const settings = getSettings();
  const maxTurns = settings.maxConversationTurns || 50;
  const maxMessages = maxTurns * 2; // 2 messages per turn (user + assistant)

  if (nonEmpty.length > maxMessages) {
    console.log(
      `[buildConversationHistory] Truncating history from ${nonEmpty.length} to ${maxMessages} messages (max turns: ${maxTurns})`
    );
    return nonEmpty.slice(-maxMessages);
  }

  return nonEmpty;
}

export { buildConversationHistory };
