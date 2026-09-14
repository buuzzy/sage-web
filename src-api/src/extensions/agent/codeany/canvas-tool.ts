/**
 * In-process `render_canvas` tool — structured canvas delivery experiment.
 *
 * Instead of the model embedding HTML inside a `canvas:html` markdown block,
 * the model calls this tool with the HTML as a structured argument.
 * processMessage intercepts the tool_use block to yield the HTML as a
 * canvas text message the frontend already knows how to render.
 *
 * NOTE: We bypass the SDK's tool()/createSdkMcpServer() helpers because they
 * depend on Zod v3 internals (_parse, zodToJsonSchema) that break with the
 * project's Zod v4. We construct the McpSdkServerConfig manually with a plain
 * JSON schema and a handler function — no Zod involvement at all.
 */
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('CanvasTool');

export const CANVAS_TOOL_NAME = 'render_canvas';
export const CANVAS_SERVER_NAME = 'canvas';
export const CANVAS_TOOL_FULL_NAME = `mcp__${CANVAS_SERVER_NAME}__${CANVAS_TOOL_NAME}`;

/** Plain JSON schema for the render_canvas tool input (no Zod) */
const RENDER_CANVAS_SCHEMA = {
  type: 'object' as const,
  properties: {
    html: {
      type: 'string',
      description: '完整的画布 HTML 内容，包含 style、script、echarts 调用。不要包含 html/head/body 标签。',
    },
    title: {
      type: 'string',
      description: '画布标题',
    },
  },
  required: ['html'],
};

/**
 * Manually construct the SDK MCP server config for render_canvas.
 * This mirrors what createSdkMcpServer() would produce, but without Zod.
 */
export function createCanvasMcpServer() {
  const fullName = CANVAS_TOOL_FULL_NAME;
  return {
    type: 'sdk' as const,
    name: CANVAS_SERVER_NAME,
    version: '1.0.0',
    tools: [
      {
        name: fullName,
        description:
          '渲染可视化画布。当需要输出图表、表格、指标卡片、时间线等可视化内容时调用此工具，传入完整的 HTML（含内联 style 和 script）。画布会渲染到用户右侧面板，不要在对话文本中输出 HTML。',
        inputSchema: RENDER_CANVAS_SCHEMA,
        isReadOnly: () => true,
        isConcurrencySafe: () => true,
        isEnabled: () => true,
        async prompt() {
          return '渲染可视化画布到右侧面板';
        },
        async call(input: { html?: string; title?: string }) {
          // 工程兜底：html 必须是字符串。模型偶发把长 HTML 拆成
          // {$text, script, style...} 对象（2026-09-14 实测），此前会以
          // "0 字符 HTML" 假成功放行，画布静默空白。错误指引转向
          // render_chart（数据服务端注入）而非让模型重抄一遍 HTML。
          const html = input?.html;
          if (typeof html !== 'string' || html.length < 10) {
            logger.warn(
              `[render_canvas] rejected: html is ${typeof html}, ${typeof html === 'string' ? html.length : 0} chars`
            );
            return {
              type: 'tool_result' as const,
              tool_use_id: '',
              content:
                'render_canvas 调用失败：html 参数必须是完整的字符串（本次收到的是 ' +
                `${typeof html}）。渲染行情/财务图表请改用 render_chart(chart_type, data_key, title)` +
                '，数据由系统自动注入，无需手写 HTML。',
              is_error: true,
            };
          }
          logger.info(
            `[render_canvas] called with ${html.length} chars of HTML${input?.title ? `, title="${input.title}"` : ''}`
          );
          const text = `画布已渲染${input?.title ? `：${input.title}` : ''}（${html.length} 字符 HTML）。继续输出文字分析即可。`;
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
