/**
 * DeepSeek OpenAI-compatible JSON helper for mobile investment workflows.
 *
 * Used by lightweight product-state LLM calls (idea classification and analysis),
 * not by the general Agent provider stack.
 */

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
export const DEEPSEEK_V4_FLASH_MODEL = 'deepseek-v4-flash';

interface DeepSeekJsonRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
}

interface DeepSeekChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

function deepSeekChatUrl(): string {
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || DEEPSEEK_BASE_URL).replace(/\/+$/, '');
  return `${baseUrl}/chat/completions`;
}

export async function callDeepSeekJson(input: DeepSeekJsonRequest): Promise<Record<string, unknown>> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY missing');

  const res = await fetch(deepSeekChatUrl(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: DEEPSEEK_V4_FLASH_MODEL,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
      temperature: input.temperature,
      max_tokens: input.maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`DeepSeek JSON request failed (HTTP ${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as DeepSeekChatCompletionResponse & {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string }; finish_reason?: string }>;
  };
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  const finishReason = choice?.finish_reason;

  // 推理模型（deepseek-v4-flash）可能把答案放进 reasoning_content，content 为空。
  // 这里仅做明确报错，便于上游区分「模型不可用」与「token 用尽」两种场景。
  if (!content) {
    const reasoningLen = (choice?.message?.reasoning_content ?? '').length;
    if (finishReason === 'length') {
      throw new Error(
        `DeepSeek reasoning model exhausted max_tokens (reasoning used ${reasoningLen} chars before content could finish); ` +
          `increase max_tokens to give reasoning + content enough room.`
      );
    }
    if (reasoningLen > 0) {
      throw new Error(
        `DeepSeek reasoning model put answer in reasoning_content (${reasoningLen} chars) but content is empty; ` +
          `fall back to non-reasoning model or extract JSON from reasoning_content.`
      );
    }
    throw new Error('DeepSeek JSON request returned empty content');
  }

  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch (err) {
    const preview = content.slice(0, 120);
    throw new Error(
      `DeepSeek response is not valid JSON (finish_reason=${finishReason}, len=${content.length}): ${preview}`
    );
  }
}
