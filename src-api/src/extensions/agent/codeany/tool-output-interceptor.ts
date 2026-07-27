/**
 * PostToolUse hooks for canvas triggering.
 *
 * Two interceptors:
 *   1. Minishare MCP tools — data-visualization tools get a canvas:html hint appended.
 *   2. WebSearch — appends a canvas hint for structured search results.
 *
 * The old westock/Bash interceptor (URL pattern matching, JSON structure
 * detection, 600+ lines) has been removed. MCP tools already return
 * pre-formatted text, so token compression is no longer needed.
 */

import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('ToolOutputInterceptor');

// ---------------------------------------------------------------------------
// Canvas hint text
// ---------------------------------------------------------------------------

const CANVAS_HINT_DATA =
  '\n\n请基于上述数据用 canvas:html 输出可视化画布（使用 echarts 绘制图表），并撰写分析。';

const CANVAS_HINT_LIGHT =
  '\n\n请根据上述结果自行判断是否适合用 canvas:html 输出可视化画布：如果包含可结构化展示的数据（表格、时间线、列表对比、关键指标等），请输出 canvas:html 画布并撰写分析；如果是纯知识问答则直接文字回答即可。';

// ---------------------------------------------------------------------------
// Minishare MCP tool name constants
// ---------------------------------------------------------------------------

// Tools that return numeric/tabular data — always trigger canvas
const DATA_CANVAS_TOOLS = [
  'daily',
  'weekly',
  'monthly',
  'daily_basic',
  'income',
  'balancesheet',
  'cashflow',
  'forecast',
  'dividend',
  'fina_indicator',
  'moneyflow',
  'top_list',
  'top_inst',
  'margin_detail',
  'pledge_stat',
  'repurchase',
  'stk_holdernumber',
  'fund_daily',
  'fund_nav',
  'fund_portfolio',
  'fund_share',
  'stk_factor',
  'bak_basic',
];

// Tools that return text/lists — optional canvas
const TEXT_CANVAS_TOOLS = [
  'news',
  'major_news',
  'cctv_news',
  'research_report',
  'anns_d',
  'irm_qa',
  'npr',
  'stock_basic',
  'new_share',
  'stk_managers',
];

// ---------------------------------------------------------------------------
// Hook factories
// ---------------------------------------------------------------------------

/**
 * Generate PostToolUse hooks for each minishare MCP tool that should
 * trigger canvas output.
 *
 * The SDK matches hooks by exact tool name, so we register one hook per
 * tool. This is intentional — it keeps the matching deterministic and
 * avoids fragile regex/prefix logic.
 */
export function createMinishareCanvasHooks(): Array<{
  matcher: string;
  hooks: Array<(input: { toolOutput?: unknown }) => Promise<{ modifiedOutput: string } | undefined>>;
}> {
  const hooks: Array<{
    matcher: string;
    hooks: Array<(input: { toolOutput?: unknown }) => Promise<{ modifiedOutput: string } | undefined>>;
  }> = [];

  for (const tool of DATA_CANVAS_TOOLS) {
    const toolName = `mcp__minishare__${tool}`;
    hooks.push({
      matcher: toolName,
      hooks: [
        async (input: { toolOutput?: unknown }) => {
          const output = typeof input.toolOutput === 'string' ? input.toolOutput : '';
          if (!output || output.length < 5) return undefined;
          logger.info(`[PostToolUse] ${toolName} intercepted (${output.length} chars), appending canvas hint`);
          return { modifiedOutput: output + CANVAS_HINT_DATA };
        },
      ],
    });
  }

  for (const tool of TEXT_CANVAS_TOOLS) {
    const toolName = `mcp__minishare__${tool}`;
    hooks.push({
      matcher: toolName,
      hooks: [
        async (input: { toolOutput?: unknown }) => {
          const output = typeof input.toolOutput === 'string' ? input.toolOutput : '';
          if (!output || output.length < 10) return undefined;
          logger.info(`[PostToolUse] ${toolName} intercepted (${output.length} chars), appending light canvas hint`);
          return { modifiedOutput: output + CANVAS_HINT_LIGHT };
        },
      ],
    });
  }

  return hooks;
}

// ---------------------------------------------------------------------------
// WebSearch interceptor (unchanged)
// ---------------------------------------------------------------------------

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

        return { modifiedOutput: toolOutput + CANVAS_HINT_LIGHT };
      },
    ],
  };
}
