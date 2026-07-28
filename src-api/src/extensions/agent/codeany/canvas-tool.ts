/**
 * In-process `render_canvas` tool — structured canvas delivery experiment.
 *
 * Instead of the model embedding HTML inside a `canvas:html` markdown block,
 * the model calls this tool with the HTML as a structured argument.
 * processMessage intercepts the tool_use block to yield the HTML as a
 * canvas text message the frontend already knows how to render.
 */
import { z } from 'zod';
import { tool, createSdkMcpServer } from '@codeany/open-agent-sdk';
import type { McpSdkServerConfig } from '@codeany/open-agent-sdk';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('CanvasTool');

export const CANVAS_TOOL_NAME = 'render_canvas';
export const CANVAS_SERVER_NAME = 'canvas';
export const CANVAS_TOOL_FULL_NAME = `mcp__${CANVAS_SERVER_NAME}__${CANVAS_TOOL_NAME}`;

const renderCanvasTool = tool(
  CANVAS_TOOL_NAME,
  '渲染可视化画布。当需要输出图表、表格、指标卡片、时间线等可视化内容时调用此工具，传入完整的 HTML（含内联 style 和 script）。画布会渲染到用户右侧面板，不要在对话文本中输出 HTML。',
  {
    html: z.string().describe('完整的画布 HTML 内容，包含 style、script、echarts 调用。不要包含 html/head/body 标签。'),
    title: z.string().optional().describe('画布标题'),
  } as any,
  async (args) => {
    const htmlLen = args.html?.length || 0;
    logger.info(`[render_canvas] called with ${htmlLen} chars of HTML${args.title ? `, title="${args.title}"` : ''}`);
    return {
      content: [
        { type: 'text', text: `画布已渲染${args.title ? `：${args.title}` : ''}（${htmlLen} 字符 HTML）。继续输出文字分析即可。` },
      ],
    };
  },
);

export function createCanvasMcpServer(): McpSdkServerConfig {
  return createSdkMcpServer({
    name: CANVAS_SERVER_NAME,
    version: '1.0.0',
    tools: [renderCanvasTool],
  });
}
