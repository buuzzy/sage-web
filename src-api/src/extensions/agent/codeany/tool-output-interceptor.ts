/**
 * PostToolUse hooks for chart/canvas triggering.
 *
 * Two interceptors:
 *   1. Minishare MCP tools — data tools get parsed+cached, and the LLM receives
 *      a render_chart hint with a data_key. The server generates ECharts HTML
 *      from the cached data, so the LLM never transcribes numbers manually.
 *   2. WebSearch — appends a canvas hint for structured search results.
 */

import { createLogger } from '@/shared/utils/logger';
import { parseAndCache } from './data-cache';

const logger = createLogger('ToolOutputInterceptor');

// ---------------------------------------------------------------------------
// Hint text
// ---------------------------------------------------------------------------

const CANVAS_HINT_LIGHT =
  '\n\n请根据上述结果自行判断是否适合调用 render_canvas 工具输出可视化画布：如果包含可结构化展示的数据（表格、时间线、列表对比、关键指标等），请调用 render_canvas 工具输出画布并撰写分析；如果是纯知识问答则直接文字回答即可。';

// Fallback when structured parsing fails
const CANVAS_HINT_FALLBACK =
  '\n\n请基于上述数据调用 render_canvas 工具输出可视化画布（使用 echarts 绘制图表），然后撰写文字分析。';

// ---------------------------------------------------------------------------
// Minishare MCP tool name constants
// ---------------------------------------------------------------------------

/**
 * Map of data tools to their suggested chart type.
 * The hint includes this suggestion so the LLM knows which chart_type to use,
 * but the LLM can override if context demands it.
 */
const TOOL_CHART_TYPE: Record<string, string> = {
  daily: 'candlestick',
  weekly: 'candlestick',
  monthly: 'candlestick',
  fund_daily: 'candlestick',
  daily_basic: 'line',
  fina_indicator: 'line',
  fund_nav: 'line',
  fund_share: 'line',
  moneyflow: 'line',
  income: 'table',
  balancesheet: 'table',
  cashflow: 'table',
  forecast: 'table',
  dividend: 'table',
  express: 'table',
  fina_mainbz: 'table',
  top_list: 'table',
  top_inst: 'table',
  margin_detail: 'table',
  pledge_stat: 'table',
  repurchase: 'table',
  stk_holdernumber: 'table',
  fund_portfolio: 'table',
  stk_factor: 'table',
  bak_basic: 'table',
};

// Tools that return text/lists — optional canvas (unchanged behavior)
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
  'hsgt_top10',
];

// ---------------------------------------------------------------------------
// Hook factories
// ---------------------------------------------------------------------------

/**
 * Generate PostToolUse hooks for each minishare MCP data tool.
 *
 * Each hook:
 *   1. Parses the tool output into a structured dataset and caches it.
 *   2. Appends a hint telling the LLM to call render_chart with the data_key,
 *      so chart HTML is generated server-side from real data.
 *   3. Falls back to the old render_canvas hint if parsing fails.
 */
export function createMinishareCanvasHooks(): Array<{
  matcher: string;
  hooks: Array<(input: { toolOutput?: unknown }) => Promise<{ modifiedOutput: string } | undefined>>;
}> {
  const hooks: Array<{
    matcher: string;
    hooks: Array<(input: { toolOutput?: unknown }) => Promise<{ modifiedOutput: string } | undefined>>;
  }> = [];

  for (const tool of Object.keys(TOOL_CHART_TYPE)) {
    const toolName = `mcp__minishare__${tool}`;
    const suggestedType = TOOL_CHART_TYPE[tool];

    hooks.push({
      matcher: toolName,
      hooks: [
        async (input: { toolOutput?: unknown }) => {
          const output = typeof input.toolOutput === 'string' ? input.toolOutput : '';
          if (!output || output.length < 5) return undefined;

          // Parse and cache the structured data
          const dataKey = parseAndCache(output, tool);

          let hint: string;
          if (dataKey) {
            logger.info(
              `[PostToolUse] ${toolName} parsed+cached as ${dataKey}, suggesting render_chart(${suggestedType})`
            );
            if (suggestedType === 'line') {
              hint =
                `\n\n[系统提示] 数据已自动结构化缓存（data_key: "${dataKey}"）。` +
                `请调用 render_chart(chart_type="${suggestedType}", data_key="${dataKey}", title="...") 渲染图表。` +
                `可在 series 参数中指定要绘制的指标列名（如 ["PE","PB"]），省略则自动选择。` +
                `系统自动注入真实数据，无需手动抄写数字。渲染后继续撰写文字分析。`;
            } else {
              hint =
                `\n\n[系统提示] 数据已自动结构化缓存（data_key: "${dataKey}"）。` +
                `请调用 render_chart(chart_type="${suggestedType}", data_key="${dataKey}", title="...") 渲染图表。` +
                `系统自动注入真实数据，无需手动抄写数字。渲染后继续撰写文字分析。`;
            }
          } else {
            logger.info(
              `[PostToolUse] ${toolName} parsing failed, falling back to render_canvas hint`
            );
            hint = CANVAS_HINT_FALLBACK;
          }

          return { modifiedOutput: output + hint };
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
