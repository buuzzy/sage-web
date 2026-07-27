/**
 * Sage-owned adapter around SDK PostToolUse hooks.
 *
 * The SDK patch only provides a generic ability to replace tool output through
 * `modifiedOutput`. Detection, artifact queueing, and summary semantics live in
 * this adapter so they remain Sage product code rather than vendor SDK code.
 */

import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('ToolOutputInterceptor');

export interface ToolOutputMetadata {
  skill: string;
  action: string;
  list_code?: string;
}

export interface ToolOutputInterceptResult {
  metadata: ToolOutputMetadata;
  summary: string;
}

export interface ToolOutputInterceptorOptions {
  intercept: (
    command: string,
    output: string
  ) => ToolOutputInterceptResult | null;
}

function extractCommand(toolInput: unknown): string {
  if (typeof toolInput === 'string') return toolInput;
  if (toolInput && typeof toolInput === 'object') {
    const command = (toolInput as Record<string, unknown>).command;
    return typeof command === 'string' ? command : '';
  }
  return '';
}

export function createToolOutputInterceptorHook({
  intercept,
}: ToolOutputInterceptorOptions) {
  return {
    matcher: 'Bash',
    hooks: [
      async (input: {
        toolInput?: unknown;
        toolOutput?: unknown;
      }): Promise<{ modifiedOutput: string } | undefined> => {
        const toolOutput =
          typeof input.toolOutput === 'string' ? input.toolOutput : '';
        const command = extractCommand(input.toolInput);
        const result = intercept(command, toolOutput);
        if (!result) return undefined;

        logger.info(
          `[PostToolUse] Intercepted → ${result.metadata.skill}/${result.metadata.action}, summary ${result.summary.length} chars`
        );

        return { modifiedOutput: result.summary };
      },
    ],
  };
}

const WEBSEARCH_CANVAS_HINT =
  '\n\n请根据上述搜索结果自行判断是否适合用 canvas:html 输出可视化画布：如果包含可结构化展示的数据（表格、时间线、列表对比、关键指标等），请输出 canvas:html 画布并撰写分析；如果是纯知识问答则直接文字回答即可，无需画布。';

export function createWebSearchInterceptorHook() {
  return {
    matcher: 'WebSearch',
    hooks: [
      async (input: {
        toolInput?: unknown;
        toolOutput?: unknown;
      }): Promise<{ modifiedOutput: string } | undefined> => {
        const toolOutput =
          typeof input.toolOutput === 'string' ? input.toolOutput : '';
        if (!toolOutput || toolOutput.length < 10) return undefined;
        if (toolOutput.includes('Search failed') || toolOutput.includes('Search error')) {
          return undefined;
        }

        logger.info(
          `[PostToolUse] WebSearch output intercepted (${toolOutput.length} chars), appending canvas hint`
        );

        return { modifiedOutput: toolOutput + WEBSEARCH_CANVAS_HINT };
      },
    ],
  };
}
