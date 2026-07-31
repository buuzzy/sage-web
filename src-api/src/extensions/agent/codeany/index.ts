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

import { createAgent as createSdkAgent } from '@codeany/open-agent-sdk';
import { getOrCreateAgent, toNormalizedMessages, evictAgent } from './agent-pool';

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
import { createCanvasMcpServer, CANVAS_TOOL_FULL_NAME } from './canvas-tool';
import { createChartMcpServer, CHART_TOOL_FULL_NAME } from './chart-tool';
import { getCachedData } from './data-cache';
import { generateChartHTML } from './chart-templates';
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
  'Bash',
  'WebSearch',
  'WebFetch',
  'Skill',
  'Task',
  'TodoWrite',
  // 内置 memory MCP server 暴露的工具：让 Agent 能召回用户历史对话原文。
  'mcp__memory__search_memory',
  // C-plan experiment: structured canvas delivery via tool call
  CANVAS_TOOL_FULL_NAME,
  CHART_TOOL_FULL_NAME,
];

// ============================================================================
// CodeAny Agent class
// ============================================================================

/**
 * Derive a reasonable history token budget from the model name.
 * Uses 80% of the model's context window to leave headroom for system prompt,
 * tool definitions, and the current turn.
 */
function getHistoryBudget(model?: string): number {
  if (!model) return 100000;
  const m = model.toLowerCase();
  if (m.includes('minimax') || m.includes('deepseek') || m.includes('opus')) return 800000;
  if (m.includes('sonnet') || m.includes('haiku') || m.includes('gpt-4o')) return 160000;
  if (m.includes('qwen')) return 104000;
  return 100000;
}

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
 ): Record<string, any> {
   if (!userId || !isSupabaseConfigured()) {
     // Even without memory server, inject the minishare data MCP
     const minishareUrl = process.env.MINISHARE_MCP_URL;
   if (!minishareUrl) return {};
   return {
     minishare: {
       type: 'sse',
       url: minishareUrl,
     },
     canvas: createCanvasMcpServer(),
     chart: createChartMcpServer(),
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
   const servers: Record<string, any> = {
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
  servers.canvas = createCanvasMcpServer();
  servers.chart = createChartMcpServer();
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
      const maxContextTokens = (this.config.providerConfig?.maxHistoryTokens as number) || getHistoryBudget(this.config.model);

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
    const maxTokens = (this.config.providerConfig?.maxHistoryTokens as number) || getHistoryBudget(this.config.model);
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
           // C-plan experiment: intercept render_canvas tool call and yield
           // the HTML as a canvas:html text block the frontend already renders.
           if (block.name === CANVAS_TOOL_FULL_NAME || block.name === 'render_canvas') {
             const toolInput = block.input as Record<string, unknown> | undefined;
             const html = toolInput?.html as string;
             if (html && html.length > 10) {
               logger.info(`[processMessage] render_canvas intercepted: ${html.length} chars HTML, yielding as canvas text`);
               yield { type: 'text', content: '```canvas:html\n' + html + '\n```' };
             }
           }
           // Structured chart: generate HTML server-side from cached data.
           if (block.name === CHART_TOOL_FULL_NAME || block.name === 'render_chart') {
             const chartInput = block.input as Record<string, unknown> | undefined;
             const chartType = chartInput?.chart_type as string;
             const dataKey = chartInput?.data_key as string;
             const chartTitle = (chartInput?.title as string) || '数据图表';
             const chartSubtitle = chartInput?.subtitle as string | undefined;
             const chartSeries = chartInput?.series as string[] | undefined;

             const cachedData = dataKey ? getCachedData(dataKey) : undefined;
             if (cachedData) {
               const html = generateChartHTML(chartType || 'table', cachedData, {
                 title: chartTitle,
                 ...(chartSubtitle ? { subtitle: chartSubtitle } : {}),
                 ...(chartSeries ? { series: chartSeries } : {}),
               });
               logger.info(
                 `[processMessage] render_chart: type=${chartType}, key=${dataKey}, ${html.length} chars HTML`
               );
               yield { type: 'text', content: '```canvas:html\n' + html + '\n```' };
             } else {
               logger.warn(
                 `[processMessage] render_chart: data_key "${dataKey}" not found in cache`
               );
             }
           }
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
    logger.info('[CodeAny ' + session.id + '] Working Directory: ' + sessionCwd);

    const sentTextHashes = new Set<string>();
    const sentToolIds = new Set<string>();

    const sandboxOpts: SandboxOptions | undefined = options?.sandbox?.enabled
      ? { enabled: true, image: options.sandbox.image, apiEndpoint: options.sandbox.apiEndpoint || SANDBOX_API_URL }
      : undefined;

    // Save images to disk (SDK query() accepts string only)
    let imagePaths: string[] = [];
    if (options?.images && options.images.length > 0) {
      imagePaths = await saveImagesToDisk(options.images, sessionCwd);
    }

    // Build the clean prompt: workspace instruction + language + current question only.
    // Conversation history is NO LONGER flattened into the prompt — it goes through
    // the SDK Agent's native message array via priorMessages or accumulated history.
    const languageInstruction = buildLanguageInstruction(options?.language, prompt);
    const baseSageSystemPrompt = await getSageSystemPrompt();
    const personaSection = await buildPersonaSection(options?.userId, options?.accessToken);
    const recallSection = await buildActiveRecallSection({
      prompt,
      userId: options?.userId,
      accessToken: options?.accessToken,
      conversation: options?.conversation,
    });
    const sageSystemPrompt = [baseSageSystemPrompt, personaSection, recallSection]
      .filter((s) => s && s.length > 0)
      .join('\n');

    const workspacePrompt = getWorkspaceInstruction(sessionCwd, sandboxOpts);
    let finalPrompt = workspacePrompt + languageInstruction + prompt;
    if (imagePaths.length > 0) {
      finalPrompt += '\n\n[Attached image file(s) saved to disk: ' + imagePaths.join(', ') + ']';
    }

    // Load MCP servers
    const userMcpServers = await loadMcpServers(options?.mcpConfig as McpConfig | undefined);
    const builtinMcpServers = this.buildBuiltinMcpServers(options?.userId, options?.accessToken);
    const allMcpServers = { ...builtinMcpServers, ...userMcpServers };

    // Dynamically swap in relevant skills
    await refreshSkillsForPrompt(prompt);

    // Build SDK options for this turn
    const sdkOpts = this.buildSdkOptions(sessionCwd, options, {
      abortController: options?.abortController || session.abortController,
    }, sageSystemPrompt);

    if (Object.keys(allMcpServers).length > 0) {
      sdkOpts.mcpServers = allMcpServers;
    }

    // Convert conversation history to structured messages for bootstrap
    const priorMessages = options?.conversation && options.conversation.length > 0
      ? toNormalizedMessages(options.conversation)
      : undefined;

    const taskId = options?.taskId || session.id;

    logger.info('[CodeAny ' + session.id + '] ========== AGENT START (pooled) ==========');
    logger.info('[CodeAny ' + session.id + '] Model: ' + (this.config.model || '(default)'));
    logger.info('[CodeAny ' + session.id + '] Prompt: ' + finalPrompt.length + ' chars');
    logger.info('[CodeAny ' + session.id + '] priorMessages: ' + (priorMessages?.length || 0));

    // Total run timeout
    const TOTAL_RUN_TIMEOUT_MS = 2 * 60 * 1000;
    const timeoutTimer = setTimeout(() => {
      logger.warn('[CodeAny ' + session.id + '] Total run timeout — aborting');
      session.abortController.abort();
    }, TOTAL_RUN_TIMEOUT_MS);

    try {
      // Get or create a pooled SDK Agent instance.
      // New agents get priorMessages injected; existing agents skip this
      // because they already have history accumulated internally.
      const { agent: sdkAgent, isNew } = await getOrCreateAgent({
        taskId,
        factory: () => {
          const opts: any = { ...sdkOpts };
          if (priorMessages && priorMessages.length > 0) {
            opts.priorMessages = priorMessages;
          }
          return createSdkAgent(opts);
        },
      });

      // For existing agents: apply this turn's overrides (abort, system prompt append)
      if (!isNew) {
        // The pooled agent already has conversation history in its internal state.
        // We just need to pass the current prompt and any per-turn overrides.
      }

      const MAX_TOOL_CALLS = 20;
      let totalToolCalls = 0;
      let warnedToolLimit = false;
      let sawToolActivity = false;
      let sawFinalTextAfterTool = false;
      let finalResultSubtype: string | undefined;

      // Use the pooled agent's query() method instead of stateless query()
      for await (const message of sdkAgent.query(finalPrompt, sdkOpts as any)) {
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
        if (totalToolCalls >= MAX_TOOL_CALLS && !warnedToolLimit) {
          warnedToolLimit = true;
          logger.warn('[CodeAny ' + session.id + '] Tool call limit reached');
        }
      }

      if (sawToolActivity && !sawFinalTextAfterTool) {
        const reason = finalResultSubtype && finalResultSubtype !== 'success'
          ? '\u672c\u8f6e\u6267\u884c\u7ed3\u675f\u72b6\u6001\uff1a' + finalResultSubtype + '\u3002'
          : '\u672c\u8f6e\u5de5\u5177\u68c0\u7d22\u5df2\u7ecf\u7ed3\u675f\uff0c\u4f46\u6a21\u578b\u6ca1\u6709\u751f\u6210\u6700\u7ec8\u603b\u7ed3\u3002';
        yield {
          type: 'text',
          content: reason + '\n\n\u6211\u5df2\u7ecf\u505c\u6b62\u7ee7\u7eed\u8c03\u7528\u5de5\u5177\uff0c\u907f\u514d\u7a7a\u8f6c\u3002\u4f60\u53ef\u4ee5\u76f4\u63a5\u8ba9\u6211\u201c\u57fa\u4e8e\u5df2\u68c0\u7d22\u7ed3\u679c\u603b\u7ed3\u201d\uff0c\u6216\u628a\u8303\u56f4\u7f29\u5c0f\u540e\u7ee7\u7eed\u8ffd\u95ee\u3002',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[CodeAny ' + session.id + '] Error:', { message: errorMessage });

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
        yield { type: 'error', message: '__CUSTOM_API_ERROR__|' + this.config.baseUrl + '|' + LOG_FILE_PATH };
      } else {
        yield { type: 'error', message: '__INTERNAL_ERROR__|' + LOG_FILE_PATH };
      }
    } finally {
      clearTimeout(timeoutTimer);
      this.sessions.delete(session.id);
      yield { type: 'done' };
    }
  }

  // plan() and execute() are deprecated — single-path architecture.
  // Both delegate to run() which has full tools + conversation context.
  async *plan(prompt: string, options?: PlanOptions): AsyncGenerator<AgentMessage> {
    logger.info('[CodeAny] plan() delegated to run() (single-path architecture)');
    yield* this.run(prompt, options as AgentOptions);
  }

  async *execute(options: ExecuteOptions): AsyncGenerator<AgentMessage> {
    logger.info('[CodeAny] execute() delegated to run() (single-path architecture)');
    yield* this.run(options.originalPrompt, options as AgentOptions);
  }
}

// ============================================================================
// Factory & Plugin

export function createCodeAnyAgent(config: AgentConfig): CodeAnyAgent {
  return new CodeAnyAgent(config);
}

export const codeanyPlugin: AgentPlugin = defineAgentPlugin({
  metadata: CODEANY_METADATA,
  factory: (config) => createCodeAnyAgent(config),
});
