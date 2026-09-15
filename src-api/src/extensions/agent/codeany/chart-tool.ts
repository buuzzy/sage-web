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
import { getCachedData } from './data-cache';

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
      description: '数据缓存键，从工具返回结果中的提示获取。单数据集图表用此参数。',
    },
    data_keys: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description:
        '多标的对比模式：传入 2-5 个数据缓存键，系统按日期对齐并归一化（起点=100）生成对比折线图。与 data_key 二选一。',
    },
    names: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: '（仅对比模式）各序列的图例名称，顺序与 data_keys 一致。省略则自动取名。',
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
  required: ['chart_type', 'title'],
};

/** Normalize & validate the keys for one render_chart call. Returns keys or an error message. */
function resolveKeys(input: {
  data_key?: string;
  data_keys?: unknown;
}): { keys: string[]; error?: string } {
  const single = typeof input?.data_key === 'string' ? input.data_key.trim() : '';
  const multi = Array.isArray(input?.data_keys)
    ? input.data_keys
        .filter((k): k is string => typeof k === 'string' && k.trim() !== '')
        .map((k) => k.trim())
    : [];

  if (multi.length === 1) {
    return {
      keys: [],
      error: '对比模式（data_keys）需要至少 2 个缓存键；单数据集请改用 data_key 参数。',
    };
  }
  const keys = multi.length > 0 ? multi.slice(0, 5) : single ? [single] : [];
  if (keys.length === 0) {
    return {
      keys: [],
      error: '必须提供 data_key（单数据集）或 data_keys（2-5 个缓存键，多标的对比）。',
    };
  }
  const missing = keys.filter((k) => !getCachedData(k));
  if (missing.length > 0) {
    return {
      keys: [],
      error: `以下 data_key 未命中缓存（缓存有效期 10 分钟）：${missing.join(', ')}。请重新调用对应数据工具获取新缓存后再渲染。`,
    };
  }
  return { keys };
}

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
          '渲染结构化图表（K线/折线/表格/多标的对比）。传入 chart_type、data_key（或对比模式 data_keys）和 title，系统自动从缓存注入真实数据并按日期对齐归一化。不要手动抄写数字，不要手写 HTML。',
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
          data_keys?: unknown;
          names?: unknown;
          title?: string;
        }) {
          const { keys, error } = resolveKeys(input);
          if (error) {
            logger.warn(`[render_chart] rejected: ${error}`);
            return {
              type: 'tool_result' as const,
              tool_use_id: '',
              content: `render_chart 调用失败：${error}`,
              is_error: true,
            };
          }
          logger.info(
            `[render_chart] chart_type=${input?.chart_type}, keys=${keys.join(',')}, title="${input?.title || ''}"`
          );
          const mode =
            keys.length > 1
              ? `对比图已渲染（${keys.length} 个序列，已按日期对齐并归一化）`
              : '图表已渲染';
          const text = `${mode}${input?.title ? `：${input.title}` : ''}。继续输出文字分析即可。`;
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
