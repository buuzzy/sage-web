/**
 * render_chart MCP tool — structured chart rendering without LLM data transcription.
 *
 * Instead of the LLM hand-writing ECharts HTML with hundreds of numbers, it
 * calls this tool with just a chart_type, data_key (from the cached tool
 * output), and title. The server generates the HTML from cached data in
 * processMessage, ensuring the chart uses exact source numbers.
 *
 * The tool handler itself just returns a confirmation — the actual HTML
 * generation happens in processMessage when it intercepts the tool_use block.
 */

import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('ChartTool');

export const CHART_TOOL_NAME = 'render_chart';
export const CHART_TOOL_FULL_NAME = `mcp__chart__${CHART_TOOL_NAME}`;

/** Plain JSON schema for the render_chart tool input (no Zod) */
const RENDER_CHART_SCHEMA = {
  type: 'object' as const,
  properties: {
    chart_type: {
      type: 'string' as const,
      enum: ['candlestick', 'line', 'table'],
      description:
        '图表类型。candlestick=K线图（日/周/月线），line=折线趋势图（PE/PB/ROE等指标），table=数据表格（财务报表等）。',
    },
    data_key: {
      type: 'string' as const,
      description: '数据缓存键，从工具返回结果中的提示获取。',
    },
    title: {
      type: 'string' as const,
      description: '图表标题。',
    },
    subtitle: {
      type: 'string' as const,
      description: '图表副标题（可选）。',
    },
    series: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: '（仅 line 图）要绘制的指标列名列表。省略则自动选择。',
    },
  },
  required: ['chart_type', 'data_key', 'title'],
};

export function createChartMcpServer() {
  const fullName = CHART_TOOL_FULL_NAME;
  return {
    type: 'sdk' as const,
    name: 'chart',
    version: '1.0.0',
    tools: [
      {
        name: fullName,
        description:
          '渲染结构化图表（K线/折线/表格）。传入 chart_type、data_key 和 title，系统自动从缓存注入真实数据。不要手动抄写数字。',
        inputSchema: RENDER_CHART_SCHEMA,
        isReadOnly: () => true,
        isConcurrencySafe: () => true,
        isEnabled: () => true,
        async prompt() {
          return '从缓存数据渲染结构化图表';
        },
        async call(input: {
          chart_type?: string;
          data_key?: string;
          title?: string;
        }) {
          logger.info(
            `[render_chart] chart_type=${input?.chart_type}, data_key=${input?.data_key}, title="${input?.title || ''}"`
          );
          const text = `图表已渲染${input?.title ? `：${input.title}` : ''}。继续输出文字分析即可。`;
          return {
            type: 'tool_result' as const,
            tool_use_id: '',
            content: text,
            is_error: false,
          };
        },
      },
    ],
    _sdkTools: [],
  };
}
