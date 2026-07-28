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
          const htmlLen = input?.html?.length || 0;
          logger.info(
            `[render_canvas] called with ${htmlLen} chars of HTML${input?.title ? `, title="${input.title}"` : ''}`
          );
          const text = `画布已渲染${input?.title ? `：${input.title}` : ''}（${htmlLen} 字符 HTML）。继续输出文字分析即可。`;
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
