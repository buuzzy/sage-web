/**
 * CodeAny Agent SDK Adapter
 *
 * Implementation of the IAgent interface using @codeany/open-agent-sdk.
 * Runs entirely in-process — no external CLI binary required.
 */

import { mkdir, writeFile } from 'fs/promises';
import { homedir, platform } from 'os';
import { join } from 'path';
import {
  query,
} from '@codeany/open-agent-sdk';
import type { AgentOptions as SdkAgentOptions } from '@codeany/open-agent-sdk';

import { refreshSkillsForPrompt } from '@/shared/skills/predictor';

import {
  BaseAgent,
  buildLanguageInstruction,
  formatPlanForExecution,
  getWorkspaceInstruction,
  parsePlanFromResponse,
  parsePlanningResponse,
  PLANNING_INSTRUCTION,
  type SandboxOptions,
} from '@/core/agent/base';
import { CODEANY_METADATA, defineAgentPlugin } from '@/core/agent/plugin';
import type { AgentPlugin } from '@/core/agent/plugin';
import type {
  AgentConfig,
  AgentMessage,
  AgentOptions,
  AgentProvider,
  ConversationMessage,
  ExecuteOptions,
  ImageAttachment,
  McpConfig,
  PlanOptions,
  TokenUsageSnapshot,
} from '@/core/agent/types';
import {
  DEFAULT_API_HOST,
  DEFAULT_API_PORT,
  DEFAULT_WORK_DIR,
} from '@/config/constants';
import { getSageSystemPrompt } from '@/config/prompt-loader';
import { loadMcpServers, type McpServerConfig } from '@/shared/mcp/loader';
import { isSupabaseConfigured } from '@/shared/supabase/client';

import { buildPersonaSection } from './persona-injector';
import { buildActiveRecallSection } from './active-recall';
import {
  createMinishareCanvasHooks,
  createWebSearchInterceptorHook,
} from './tool-output-interceptor';
import { createLogger, LOG_FILE_PATH } from '@/shared/utils/logger';
import { stripHashSuffix } from '@/shared/utils/url';

const logger = createLogger('CodeAnyAgent');

// Sandbox API URL
const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
const API_PORT =
  process.env.PORT || (isDev ? '2026' : String(DEFAULT_API_PORT));
const SANDBOX_API_URL =
  process.env.SANDBOX_API_URL || `http://${DEFAULT_API_HOST}:${API_PORT}`;

// ============================================================================
// Helper functions
// ============================================================================

function expandPath(inputPath: string): string {
  let result = inputPath;
  if (result.startsWith('~')) {
    result = join(homedir(), result.slice(1));
  }
  if (platform() === 'win32') {
    result = result.replace(/\//g, '\\');
  }
  return result;
}

function generateFallbackSlug(prompt: string, taskId: string): string {
  let slug = prompt
    .toLowerCase()
    .replace(/[\u4e00-\u9fff]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');

  if (!slug || slug.length < 3) {
    slug = 'task';
  }

  const suffix = taskId.slice(-6);
  return `${slug}-${suffix}`;
}

function isArtifactBlock(text: string): boolean {
  return text.trim().startsWith('```artifact:') || text.trim().startsWith('```canvas:html');
}

function getSessionWorkDir(
  workDir: string = DEFAULT_WORK_DIR,
  prompt?: string,
  taskId?: string
): string {
  const expandedPath = expandPath(workDir);

  const hasSessionsPath = expandedPath.includes('/sessions/') || expandedPath.includes('\\sessions\\');
  const endsWithSessions = expandedPath.endsWith('/sessions') || expandedPath.endsWith('\\sessions');
  if (hasSessionsPath && !endsWithSessions) {
    return expandedPath;
  }

  const baseDir = expandedPath;
  const sessionsDir = join(baseDir, 'sessions');

  let folderName: string;
  if (prompt && taskId) {
    folderName = generateFallbackSlug(prompt, taskId);
  } else if (taskId) {
    folderName = taskId;
  } else {
    folderName = `session-${Date.now()}`;
  }

  return join(sessionsDir, folderName);
}

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error('Failed to create directory:', error);
  }
}

async function saveImagesToDisk(
  images: ImageAttachment[],
  workDir: string
): Promise<string[]> {
  const savedPaths: string[] = [];
  if (images.length === 0) return savedPaths;

  await ensureDir(workDir);

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const ext = image.mimeType.split('/')[1] || 'png';
    const filename = `image_${Date.now()}_${i}.${ext}`;
    const filePath = join(workDir, filename);

    try {
      let base64Data = image.data;
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }
      const buffer = Buffer.from(base64Data, 'base64');
      await writeFile(filePath, buffer);
      savedPaths.push(filePath);
      logger.info(`[CodeAny] Saved image to: ${filePath}`);
    } catch (error) {
      logger.error(`[CodeAny] Failed to save image: ${error}`);
    }
  }

  return savedPaths;
}

// ============================================================================
// Default tools
// ============================================================================

const ALLOWED_TOOLS = [
  'Read',
  'Edit',
  'Write',
  'Glob',
  'Grep',
  'Bash',
  'WebSearch',
  'WebFetch',
  'Skill',
  'Task',
  'LSP',
  'TodoWrite',
  'Agent',       // 多 Agent 并行协作（AgentTool）
  'SendMessage', // 跨 Agent 消息传递
  // 内置 memory MCP server 暴露的工具：让 Agent 能召回用户历史对话原文。
  // SDK 给 MCP 工具的命名规则：mcp__<server-name>__<tool-name>。
  'mcp__memory__search_memory',
];

// ============================================================================
// CodeAny Agent class
// ============================================================================

export class CodeAnyAgent extends BaseAgent {
  readonly provider: AgentProvider = 'codeany';

  constructor(config: AgentConfig) {
    super(config);
    logger.info('[CodeAnyAgent] Created with config:', {
      provider: config.provider,
      hasApiKey: !!config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      workDir: config.workDir,
    });
  }

  private isUsingCustomApi(): boolean {
    return !!(this.config.baseUrl && this.config.apiKey);
  }

  private looksLikeError(output: string): boolean {
    if (!output || output.length < 10) return false;
    const lower = output.toLowerCase();
    const errorPatterns = [
      'error:', 'exception:', 'traceback', 'econnrefused',
      'etimedout', 'enotfound', 'status_code', 'failed to',
      'permission denied', 'unauthorized', 'forbidden',
      'command not found', 'no such file or directory',
    ];
    // Only flag as error for SHORT outputs (< 300 chars). Long outputs are
    // almost always real data (financial tables, JSON payloads) that happen
    // to contain numbers like 401/500/503 which are valid stock codes/prices.
    return errorPatterns.some(p => lower.includes(p)) && output.length < 300;
  }

  /**
   * Build the built-in MCP servers that sage-api always exposes.
   *
   * Currently registers `memory` MCP server (search_memory tool) when:
   *   1. options.userId is present (otherwise we can't scope queries safely)
   *   2. Supabase is configured (URL + anon key OR URL + service role key)
   *
   * The MCP server URL is local (sage-api -> sage-api on the same process),
   * so even in cloud mode (Railway) it's a loopback fetch. When SAGE_API_TOKEN
   * is set we forward it as a Bearer header to satisfy localOnlyMiddleware.
   *
   * When `accessToken` is supplied (desktop sidecar mode) it is forwarded as
   * a query-string parameter so the memory MCP can talk to Supabase under
   * user-scoped RLS. The query string never leaves loopback.
   */
 private buildBuiltinMcpServers(
   userId?: string,
   accessToken?: string
 ): Record<string, McpServerConfig> {
   if (!userId || !isSupabaseConfigured()) {
     // Even without memory server, inject the minishare data MCP
     const minishareUrl = process.env.MINISHARE_MCP_URL;
     if (!minishareUrl) return {};
     return {
       minishare: {
         type: 'sse',
         url: minishareUrl,
       },
     };
   }
   const port = process.env.PORT || '2026';
   const params = new URLSearchParams({ user_id: userId });
   if (accessToken) {
     params.set('access_token', accessToken);
   }
   const url = `http://127.0.0.1:${port}/mcp-memory?${params.toString()}`;
   const headers: Record<string, string> = {};
   if (process.env.SAGE_API_TOKEN) {
     headers.Authorization = `Bearer ${process.env.SAGE_API_TOKEN}`;
   }
   const servers: Record<string, McpServerConfig> = {
     memory: {
       type: 'http',
       url,
       ...(Object.keys(headers).length > 0 ? { headers } : {}),
     },
   };
   const minishareUrl = process.env.MINISHARE_MCP_URL;
   if (minishareUrl) {
     servers.minishare = { type: 'sse', url: minishareUrl };
   }
   return servers;
 }

  private buildSdkOptions(
    sessionCwd: string,
    options?: AgentOptions,
    extraOpts?: Partial<SdkAgentOptions>,
    systemPrompt?: string
  ): SdkAgentOptions {
    const sdkOpts: SdkAgentOptions = {
      cwd: sessionCwd,
      model: this.config.model,
      permissionMode: 'bypassPermissions',
      maxTurns: 100,
      thinking: { type: 'adaptive' },
      ...extraOpts,
    };

    // Set API type
    if (this.config.apiType) {
      (sdkOpts as any).apiType = this.config.apiType;
    }

    // Set API credentials
    if (this.config.apiKey) {
      sdkOpts.apiKey = this.config.apiKey;
    }
    if (this.config.baseUrl) {
      sdkOpts.baseURL = stripHashSuffix(this.config.baseUrl);
    }

    // Inject SOUL.md + AGENTS.md + memory as a proper system prompt field.
    // For OpenAI-compatible APIs (e.g. MiniMax) the SDK passes this as the
    // system message, ensuring the model treats it as instructions rather than
    // user input.  appendSystemPrompt appends after the SDK's built-in prompt.
    if (systemPrompt) {
      sdkOpts.appendSystemPrompt = systemPrompt;
    }

    // Set allowed tools
    sdkOpts.allowedTools = options?.allowedTools || ALLOWED_TOOLS;

    // Set abort controller
    if (options?.abortController) {
      sdkOpts.abortController = options.abortController;
    }

    // PostToolUse hooks: canvas hints for minishare MCP tools + WebSearch.
    sdkOpts.hooks = {
      ...((sdkOpts as any).hooks || {}),
      PostToolUse: [
        ...createMinishareCanvasHooks(),
        createWebSearchInterceptorHook(),
      ],
    };

    return sdkOpts;
  }

  /**
   * Build conversation context using the Context Assembler.
   * Supports disk-persisted sessions and automatic compaction.
   */
  private async buildConversationContext(
    sessionId: string,
    conversation?: ConversationMessage[]
  ): Promise<string> {
    if (!conversation || conversation.length === 0) return '';

    try {
      const { assembleContext } = await import('@/shared/context/assembler');
      const maxContextTokens = (this.config.providerConfig?.maxHistoryTokens as number) || 12000;

      const result = await assembleContext(sessionId, conversation, {
        maxContextTokens,
      });

      if (result.compacted) {
        logger.info(`[CodeAny ${sessionId}] Context compacted: ${result.estimatedTokens} tokens, ${result.recentMessageCount} recent messages kept`);
      }

      return result.context;
    } catch (err) {
      logger.warn(`[CodeAny ${sessionId}] Context assembly failed, falling back:`, err);
      return this.formatConversationHistoryFallback(conversation);
    }
  }

  /**
   * Fallback: simple truncation (used when assembler fails).
   */
  private formatConversationHistoryFallback(conversation: ConversationMessage[]): string {
    const maxTokens = (this.config.providerConfig?.maxHistoryTokens as number) || 12000;
    const parts: string[] = [];
    let budget = maxTokens;

    for (let i = conversation.length - 1; i >= 0 && budget > 0; i--) {
      const msg = conversation[i];
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const line = `${role}: ${msg.content}`;
      const tokens = Math.ceil(line.length / 4);
      if (budget - tokens < 0 && parts.length >= 2) break;
      parts.unshift(line);
      budget -= tokens;
    }

    if (parts.length === 0) return '';
    return `## Previous Conversation Context\n\n${parts.join('\n\n')}\n\n---\n## Current Request\n`;
  }

  private sanitizeText(text: string): string {
    let sanitized = text;

    // Reasoning tags are implementation details from thinking models and should
    // never become user-visible assistant content.
    sanitized = sanitized.replace(/<think>[\s\S]*?<\/think>\s*/g, '');

    // Some OpenAI-compatible gateways can leak attempted tool invocations as
    // ordinary assistant text instead of structured tool_use blocks. Keep this
    // as a protocol hygiene guard, not as model-specific routing.
    sanitized = sanitized.replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]\s*/g, '');
    sanitized = sanitized.replace(/<invoke\b[\s\S]*?<\/invoke>\s*/gi, '');
    sanitized = sanitized.replace(
      /\s*\[调用\s+[^\]]+\][\s\S]*?(?:<\/invoke>|<\/[^>\n]*DSML[^>\n]*tool_calls>)\s*/g,
      ''
    );
    sanitized = sanitized.replace(/<\/?[^>\n]*DSML[^>\n]*tool_calls>\s*/g, '');
    sanitized = sanitized.replace(/<\/(?:parameter|invoke)>\s*/gi, '');

    // Guard against the model echoing our prompt scaffolding. This has shown up
    // as visible assistant text like "Current Request / LANGUAGE REQUIREMENT",
    // which is never useful user-facing content.
    sanitized = sanitized.replace(
      /\s*#{1,6}\s*Current Request\s+#{1,6}\s*LANGUAGE REQUIREMENT[\s\S]*$/i,
      ''
    );
    sanitized = sanitized.replace(
      /^\s*Current Request\s+LANGUAGE REQUIREMENT[\s\S]*$/i,
      ''
    );
    sanitized = sanitized.replace(
      /\s*LANGUAGE REQUIREMENT\s*[-*]\s*Output language:[\s\S]*$/i,
      ''
    );

    const apiKeyErrorPatterns = [
      /Invalid API key/i, /invalid_api_key/i, /API key.*invalid/i,
      /authentication.*fail/i, /Unauthorized/i,
      /身份验证失败/, /认证失败/, /鉴权失败/, /密钥无效/,
    ];

    if (apiKeyErrorPatterns.some((p) => p.test(sanitized))) {
      return '__API_KEY_ERROR__';
    }

    return sanitized;
  }

  private *processMessage(
    message: unknown,
    sessionId: string,
    sentTextHashes: Set<string>,
    sentToolIds: Set<string>
  ): Generator<AgentMessage> {
    const msg = message as {
      type: string;
      message?: { content?: unknown[] };
      subtype?: string;
      total_cost_usd?: number;
      duration_ms?: number;
      usage?: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
      result?: { tool_use_id?: string; tool_name?: string; output?: string };
    };

    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content as Record<string, unknown>[]) {
        if ('text' in block) {
          const sanitizedText = this.sanitizeText(block.text as string);
          const textHash = sanitizedText.slice(0, 100);
         if (sanitizedText.trim() && !sentTextHashes.has(textHash)) {
           sentTextHashes.add(textHash);
           yield { type: 'text', content: sanitizedText };
          }
        } else if ('name' in block && 'id' in block) {
          const toolId = block.id as string;
          if (!sentToolIds.has(toolId)) {
            sentToolIds.add(toolId);
            yield { type: 'tool_use', id: toolId, name: block.name as string, input: block.input };
          }
        }
      }
    }

    if (msg.type === 'tool_result' && msg.result) {
      const output = msg.result.output ?? '';
      const isError = !!(msg.result as any).is_error || this.looksLikeError(output);
      yield {
        type: 'tool_result',
        toolUseId: msg.result.tool_use_id ?? '',
        name: msg.result.tool_name ?? undefined,
        output,
        isError,
      };
    }

    if (msg.type === 'result') {
      yield {
        type: 'result', content: msg.subtype,
        cost: msg.total_cost_usd, duration: msg.duration_ms,
        usage: msg.usage,
      };
    }
  }

  // ==========================================================================
  // Core agent methods
  // ==========================================================================

  async *run(prompt: string, options?: AgentOptions): AsyncGenerator<AgentMessage> {
    const session = this.createSession('executing', {
      id: options?.sessionId,
      abortController: options?.abortController,
    });
    yield { type: 'session', sessionId: session.id };

    const sessionCwd = getSessionWorkDir(
      options?.cwd || this.config.workDir, prompt, options?.taskId
    );
    await ensureDir(sessionCwd);
    logger.info(`[CodeAny ${session.id}] Working Directory: ${sessionCwd}`);

    const sentTextHashes = new Set<string>();
    const sentToolIds = new Set<string>();

    const sandboxOpts: SandboxOptions | undefined = options?.sandbox?.enabled
      ? { enabled: true, image: options.sandbox.image, apiEndpoint: options.sandbox.apiEndpoint || SANDBOX_API_URL }
      : undefined;

    // Save images to disk so they can be referenced in the text prompt
    // (The SDK's query() accepts string only; multimodal arrays are not supported)
    let imagePaths: string[] = [];
    if (options?.images && options.images.length > 0) {
      imagePaths = await saveImagesToDisk(options.images, sessionCwd);
      if (imagePaths.length > 0) {
        logger.info(`[CodeAny] Saved ${imagePaths.length} image(s) to disk`);
      }
    }

    // Use taskId as persistent context key (stable across turns); fall back to session.id
    const contextSessionId = options?.taskId || session.id;
    const conversationContext = await this.buildConversationContext(contextSessionId, options?.conversation);
    const languageInstruction = buildLanguageInstruction(options?.language, prompt);
    const baseSageSystemPrompt = await getSageSystemPrompt();
    // Phase 3: prepend「身份记忆」 — persona snapshot + recent_threads。
    // Agent 不再决策「要不要召回历史」，每次对话开始就已经认识用户。
    const personaSection = await buildPersonaSection(options?.userId, options?.accessToken);
    // Phase 4: 仅 task 首轮（conversation 为空）做按当前 query 的主动召回。
    // 后续 turn 已经看得到当轮上下文，无需重复注入。
    const recallSection = await buildActiveRecallSection({
      prompt,
      userId: options?.userId,
      accessToken: options?.accessToken,
      conversation: options?.conversation,
    });
    const sageSystemPrompt = [baseSageSystemPrompt, personaSection, recallSection]
      .filter((s) => s && s.length > 0)
      .join('\n');

    // System prompt = dateContext + SOUL.md + AGENTS.md + persona snapshot + recent_threads.
    // 长尾历史档案（>20 回合）仍由 mcp__memory__search_memory 工具按需取。
    const textPrompt = getWorkspaceInstruction(sessionCwd, sandboxOpts) + conversationContext + languageInstruction + prompt;

    // Build the final prompt: always a string (images referenced by file path)
    let finalPrompt: string;
    if (imagePaths.length > 0) {
      finalPrompt = textPrompt + `\n\n[Attached image file(s) saved to disk: ${imagePaths.join(', ')}]`;
      logger.info(`[CodeAny] Using text prompt with ${imagePaths.length} image path(s) appended`);
    } else {
      finalPrompt = textPrompt;
    }

    // Load MCP servers (user-defined from ~/.sage/mcp.json + sage built-in memory)
    const userMcpServers = await loadMcpServers(options?.mcpConfig as McpConfig | undefined);
    const builtinMcpServers = this.buildBuiltinMcpServers(
      options?.userId,
      options?.accessToken
    );
    // Order matters: user can shadow built-in by naming their server `memory`
    const allMcpServers = { ...builtinMcpServers, ...userMcpServers };

    const sdkOpts = this.buildSdkOptions(sessionCwd, options, {
      abortController: options?.abortController || session.abortController,
    }, sageSystemPrompt);

    if (Object.keys(allMcpServers).length > 0) {
      sdkOpts.mcpServers = allMcpServers;
      logger.info(`[CodeAny ${session.id}] MCP servers: ${Object.keys(allMcpServers).join(', ')}`);
    }

    logger.info(`[CodeAny ${session.id}] ========== AGENT START ==========`);
    logger.info(`[CodeAny ${session.id}] Model: ${this.config.model || '(default)'}`);
    logger.info(`[CodeAny ${session.id}] Custom API: ${this.isUsingCustomApi()}`);
    logger.info(`[CodeAny ${session.id}] Prompt length: ${finalPrompt.length} chars`);
    logger.info(`[CodeAny ${session.id}] Images (disk): ${imagePaths.length > 0 ? `yes (${imagePaths.length} files)` : 'no'}`);

    // Dynamically swap in only the skills relevant to this prompt
    // so the model context stays lean each turn.
    await refreshSkillsForPrompt(prompt);

    // ── Total run timeout ──────────────────────────────────────────────
    // A single agent turn (run/plan/execute) must complete within a hard wall clock
    // limit. Without this, a hung Bash tool (e.g. ECONNREFUSED on a TCP connect)
    // can leave the frontend displaying "Running command..." for up to 600 seconds
    // (the SDK's default Bash timeout). The user sees no progress and input is
    // silently swallowed. 2 minutes is generous enough for multi-hop tool calls
    // while short enough that the user hasn't already walked away.
    const TOTAL_RUN_TIMEOUT_MS = 2 * 60 * 1000;
    const timeoutTimer = setTimeout(() => {
      logger.warn(
        `[CodeAny ${session.id}] Total run timeout (${TOTAL_RUN_TIMEOUT_MS}ms) — aborting session`
      );
      session.abortController.abort();
    }, TOTAL_RUN_TIMEOUT_MS);

    try {
      const MAX_TOOL_CALLS = 20;
      let totalToolCalls = 0;
      let warnedToolLimit = false;
      let sawToolActivity = false;
      let sawFinalTextAfterTool = false;
      let finalResultSubtype: string | undefined;

      for await (const message of query({ prompt: finalPrompt, options: sdkOpts })) {
        if (session.abortController.signal.aborted) break;
        for (const msg of this.processMessage(message, session.id, sentTextHashes, sentToolIds)) {
          if (msg.type === 'tool_use') {
            totalToolCalls++;
            sawToolActivity = true;
            sawFinalTextAfterTool = false;
          } else if (msg.type === 'tool_result') {
            sawToolActivity = true;
            sawFinalTextAfterTool = false;
          } else if (msg.type === 'text' && msg.content && !isArtifactBlock(msg.content)) {
            sawFinalTextAfterTool = true;
          } else if (msg.type === 'result') {
            finalResultSubtype = msg.content;
          }
          yield msg;
        }
        // SDK enforces termination via maxTurns; this is just an observability signal.
        if (totalToolCalls >= MAX_TOOL_CALLS && !warnedToolLimit) {
          warnedToolLimit = true;
          logger.warn(`[CodeAny ${session.id}] Tool call limit (${MAX_TOOL_CALLS}) reached, SDK maxTurns will handle termination.`);
        }
      }

      if (sawToolActivity && !sawFinalTextAfterTool) {
        const reason =
          finalResultSubtype && finalResultSubtype !== 'success'
            ? `本轮执行结束状态：${finalResultSubtype}。`
            : '本轮工具检索已经结束，但模型没有生成最终总结。';
        yield {
          type: 'text',
          content:
            `${reason}\n\n` +
            '我已经停止继续调用工具，避免空转。你可以直接让我“基于已检索结果总结”，或把范围缩小后继续追问。',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[CodeAny ${session.id}] Error:`, { message: errorMessage });

      const noApiKeyConfigured = !this.config.apiKey;
      const usingCustomApi = this.isUsingCustomApi();

      const isApiKeyError =
        errorMessage.includes('Invalid API key') || errorMessage.includes('invalid_api_key') ||
        errorMessage.includes('API key') || errorMessage.includes('authentication') ||
        errorMessage.includes('Unauthorized') || errorMessage.includes('401') ||
        errorMessage.includes('403') || noApiKeyConfigured;

      const isApiCompatibilityError = usingCustomApi && (
        errorMessage.includes('model') || errorMessage.includes('not found')
      );

      if (isApiKeyError) {
        yield { type: 'error', message: '__API_KEY_ERROR__' };
      } else if (isApiCompatibilityError) {
        yield { type: 'error', message: `__CUSTOM_API_ERROR__|${this.config.baseUrl}|${LOG_FILE_PATH}` };
      } else {
        yield { type: 'error', message: `__INTERNAL_ERROR__|${LOG_FILE_PATH}` };
      }
    } finally {
      clearTimeout(timeoutTimer);
      this.sessions.delete(session.id);
      yield { type: 'done' };
    }
  }

  async *plan(prompt: string, options?: PlanOptions): AsyncGenerator<AgentMessage> {
    const session = this.createSession('planning', {
      id: options?.sessionId,
      abortController: options?.abortController,
    });
    yield { type: 'session', sessionId: session.id };

    const sessionCwd = getSessionWorkDir(
      options?.cwd || this.config.workDir, prompt, options?.taskId
    );
    await ensureDir(sessionCwd);
    logger.info(`[CodeAny ${session.id}] Planning started, cwd: ${sessionCwd}`);

    const workspaceInstruction = `\n## CRITICAL: Output Directory\n**ALL files must be saved to: ${sessionCwd}**\n`;
    const languageInstruction = buildLanguageInstruction(options?.language, prompt);
    const baseSageSystemPrompt = await getSageSystemPrompt();
    const planPersonaSection = await buildPersonaSection(options?.userId, options?.accessToken);
    // Phase 4: plan 必首轮，强制启用主动召回
    const planRecallSection = await buildActiveRecallSection({
      prompt,
      userId: options?.userId,
      accessToken: options?.accessToken,
      forceFirstTurn: true,
    });
    const sageSystemPrompt = [baseSageSystemPrompt, planPersonaSection, planRecallSection]
      .filter((s) => s && s.length > 0)
      .join('\n');
    const planningPrompt = workspaceInstruction + PLANNING_INSTRUCTION + languageInstruction + prompt;

    let fullResponse = '';

    const sdkOpts = this.buildSdkOptions(sessionCwd, options, {
      abortController: options?.abortController || session.abortController,
    }, sageSystemPrompt);

    // Phase 2 关键修正：plan 阶段需要 search_memory 工具来调取历史上下文，
    // 否则模型遇到「我之前问过 X 吗」这类问题只能凭空 direct_answer。
    // - 仅允许 search_memory（pure read，无副作用），其他工具留给 execute
    // - 必须同时注入 memory MCP server，否则工具名挂着也调不通
    // 必须 override buildSdkOptions 里的 allowedTools 默认值（line 939
    // 会用 ALLOWED_TOOLS 全集 fallback）。
    const planMcpServers = this.buildBuiltinMcpServers(
      options?.userId,
      options?.accessToken
    );
    if (Object.keys(planMcpServers).length > 0) {
      sdkOpts.mcpServers = planMcpServers;
      sdkOpts.allowedTools = ['mcp__memory__search_memory'];
      logger.info(`[CodeAny ${session.id}] Planning: enabled search_memory tool`);
    } else {
      sdkOpts.allowedTools = [];
    }

    // dedup sets shared with processMessage
    const sentTextHashes = new Set<string>();
    const sentToolIds = new Set<string>();

    // ── Plan phase timeout (same protection as run) ──────────────────
    const PLAN_TIMEOUT_MS = 2 * 60 * 1000;
    const planTimeoutTimer = setTimeout(() => {
      logger.warn(
        `[CodeAny ${session.id}] Plan timeout (${PLAN_TIMEOUT_MS}ms) — aborting`
      );
      session.abortController.abort();
    }, PLAN_TIMEOUT_MS);

    try {
      for await (const message of query({ prompt: planningPrompt, options: sdkOpts })) {
        if (session.abortController.signal.aborted) break;

        // 先把 assistant.text 的原文累积到 fullResponse，给 parsePlanningResponse 用。
        // sanitizeText 会剥掉 MiniMax 的 <think>...</think>，但原文里可能藏着 JSON
        // 之类的内容，因此 parser 必须看原文。
        if ((message as any).type === 'assistant' && (message as any).message?.content) {
          for (const block of (message as any).message.content as Array<Record<string, unknown>>) {
            if ('text' in block) {
              fullResponse += block.text as string;
            }
          }
        }

        // Delegate to processMessage so plan-phase tool calls (search_memory) and
        // their results get yielded → frontend → messages-sync → supabase。
        // 这是 Phase 2 P1 修复：之前 plan() 只 yield text，导致 mcp tool_use /
        // tool_result 完全不可观测，回头查 supabase messages 表全是 text，看不到
        // 工具调用了哪些 query、返回了什么。现在所有 plan 阶段的工具行为都会留痕。
        for (const msg of this.processMessage(message, session.id, sentTextHashes, sentToolIds)) {
          yield msg;
        }
      }

      if (
        !session.abortController.signal.aborted &&
        fullResponse.trim().length === 0
      ) {
        logger.warn(
          `[CodeAny ${session.id}] Planning finished with empty model response`
        );
        yield {
          type: 'error',
          message:
            '模型没有返回有效内容。请检查当前模型配置、API Key 或切换到可用模型后重试。',
        };
        return;
      }

      const planningResult = parsePlanningResponse(fullResponse);

      if (planningResult?.type === 'direct_answer') {
        yield { type: 'direct_answer', content: planningResult.answer };
      } else if (planningResult?.type === 'plan' && planningResult.plan.steps.length > 0) {
        this.storePlan(planningResult.plan);
        yield { type: 'plan', plan: planningResult.plan };
      } else {
        const plan = parsePlanFromResponse(fullResponse);
        if (plan && plan.steps.length > 0) {
          this.storePlan(plan);
          yield { type: 'plan', plan };
        } else {
          // Fallback: 当 parser 识别不出任何结构化产物时，
          // 上面的循环已经把 block.text 作为 text 消息流式 yield 给 UI 了，
          // 这里如果再把 fullResponse 打包成 direct_answer，UI 会把同样内容
          // 再追加一次（direct_answer 被渲染为 text）— 造成 transcript 里的
          // "block 4 = block 1+2+3 合并" 重复问题（见 minimax 反馈日志）。
          // 仅 yield done，让已经流式输出的 text 自己闭合。
          logger.warn(
            `[CodeAny ${session.id}] Planning produced unstructured response; ` +
            `streamed as text already, skipping duplicate direct_answer fallback.`
          );
        }
      }
    } catch (error) {
      logger.error(`[CodeAny ${session.id}] Planning error:`, error);
      yield { type: 'error', message: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(planTimeoutTimer);
      yield { type: 'done' };
    }
  }

  async *execute(options: ExecuteOptions): AsyncGenerator<AgentMessage> {
    const session = this.createSession('executing', {
      id: options.sessionId,
      abortController: options.abortController,
    });
    yield { type: 'session', sessionId: session.id };

    const plan = options.plan || this.getPlan(options.planId);
    if (!plan) {
      yield { type: 'error', message: `Plan not found: ${options.planId}` };
      yield { type: 'done' };
      return;
    }

    const sessionCwd = getSessionWorkDir(
      options.cwd || this.config.workDir, options.originalPrompt, options.taskId
    );
    await ensureDir(sessionCwd);
    logger.info(`[CodeAny ${session.id}] Executing plan: ${plan.id}, cwd: ${sessionCwd}`);

    const sandboxOpts: SandboxOptions | undefined = options.sandbox?.enabled
      ? { enabled: true, image: options.sandbox.image, apiEndpoint: options.sandbox.apiEndpoint || SANDBOX_API_URL }
      : undefined;

    const baseSageSystemPrompt = await getSageSystemPrompt();
    const execPersonaSection = await buildPersonaSection(options.userId, options.accessToken);
    // Phase 4: execute 跟随 plan 必首轮，用 originalPrompt 做主动召回
    const execRecallSection = await buildActiveRecallSection({
      prompt: options.originalPrompt,
      userId: options.userId,
      accessToken: options.accessToken,
      forceFirstTurn: true,
    });
    const sageSystemPrompt = [baseSageSystemPrompt, execPersonaSection, execRecallSection]
      .filter((s) => s && s.length > 0)
      .join('\n');
    const executionPrompt =
      formatPlanForExecution(plan, sessionCwd, sandboxOpts, options.language, options.originalPrompt) +
      '\n\nOriginal request: ' + options.originalPrompt;

    const sentTextHashes = new Set<string>();
    const sentToolIds = new Set<string>();

    const userMcpServers = await loadMcpServers(options.mcpConfig as McpConfig | undefined);
    const builtinMcpServers = this.buildBuiltinMcpServers(
      options.userId,
      options.accessToken
    );
    const allMcpServers = { ...builtinMcpServers, ...userMcpServers };

    const sdkOpts = this.buildSdkOptions(sessionCwd, options, {
      abortController: options.abortController || session.abortController,
    }, sageSystemPrompt);

    if (Object.keys(allMcpServers).length > 0) {
      sdkOpts.mcpServers = allMcpServers;
      logger.info(`[CodeAny ${session.id}] MCP servers: ${Object.keys(allMcpServers).join(', ')}`);
    }

    // Dynamically swap in only the skills relevant to this plan's original prompt
    if (options.originalPrompt) {
      await refreshSkillsForPrompt(options.originalPrompt);
    }

    // ── Execute phase timeout (same protection as run) ──────────────────
    const EXEC_TIMEOUT_MS = 2 * 60 * 1000;
    const execTimeoutTimer = setTimeout(() => {
      logger.warn(
        `[CodeAny ${session.id}] Execute timeout (${EXEC_TIMEOUT_MS}ms) — aborting`
      );
      session.abortController.abort();
    }, EXEC_TIMEOUT_MS);

    try {
      for await (const message of query({ prompt: executionPrompt, options: sdkOpts })) {
        if (session.abortController.signal.aborted) break;
        for (const msg of this.processMessage(message, session.id, sentTextHashes, sentToolIds)) {
          yield msg;
        }
      }
    } catch (error) {
      logger.error(`[CodeAny ${session.id}] Execution error:`, error);
      yield { type: 'error', message: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(execTimeoutTimer);
      this.deletePlan(options.planId);
      this.sessions.delete(session.id);
      yield { type: 'done' };
    }
  }
}

// ============================================================================
// Factory & Plugin
// ============================================================================

export function createCodeAnyAgent(config: AgentConfig): CodeAnyAgent {
  return new CodeAnyAgent(config);
}

export const codeanyPlugin: AgentPlugin = defineAgentPlugin({
  metadata: CODEANY_METADATA,
  factory: (config) => createCodeAnyAgent(config),
});
