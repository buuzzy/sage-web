/**
 * Built-in default model for the web product.
 *
 * Web users get the product experience immediately after login.
 * The API key lives ONLY in the server environment, never in the frontend.
 */

export interface BuiltInModelConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  apiType: 'anthropic-messages';
}

/**
 * Resolve the built-in default model from environment variables.
 * Returns null if the key is not configured (e.g. local dev without env).
 *
 * MiniMax-M3 uses Anthropic-compatible API (recommended per their docs).
 * Endpoint: https://api.minimaxi.com/anthropic
 */
export function getBuiltInModelConfig(): BuiltInModelConfig | null {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return null;

  return {
    apiKey,
    baseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/anthropic',
    model: process.env.MINIMAX_MODEL || 'MiniMax-M3',
    apiType: 'anthropic-messages',
  };
}

export const BUILTIN_MODEL_DISPLAY_NAME = 'Sage AI';
export const BUILTIN_MODEL_ID = 'MiniMax-M3';
