/**
 * Canvas extraction — handles canvas:html blocks only.
 *
 * Typed artifact blocks (artifact:TYPE) from the legacy system are still
 * stripped from chat text (to avoid raw JSON flashing), but they are no
 * longer rendered as canvases. All visualization is now free-form HTML
 * via canvas:html blocks.
 */

import type { AgentMessage } from '@/shared/hooks/useAgent';
import { extractArtifacts, hasIncompleteBlock } from './artifactParser';

export interface CanvasItem {
  id: string;
  title: string;
  html: string;
  messageIndex: number;
}

function hasIncompleteHtmlBlock(text: string): boolean {
  const lastOpen = text.lastIndexOf('```canvas:html');
  if (lastOpen === -1) return false;
  const afterOpen = text.slice(lastOpen);
  return afterOpen.indexOf('```', '```canvas:html'.length) === -1;
}

/**
 * Strip all canvas blocks (legacy typed + html) from text.
 * Incomplete blocks at the tail are stripped during streaming.
 */
export function stripCanvasBlocks(text: string): string {
  if (!text) return '';

  // extractArtifacts handles legacy artifact:TYPE blocks
  const { cleanText } = extractArtifacts(text);

  if (hasIncompleteHtmlBlock(cleanText)) {
    const pos = cleanText.lastIndexOf('```canvas:html');
    return pos > 0 ? cleanText.slice(0, pos).trim() : '';
  }

  return cleanText.replace(/```canvas:html\s*\n[\s\S]*?```/g, '').trim();
}

/**
 * Extract all canvas:html blocks from a message list.
 */
export function extractAllCanvases(messages: AgentMessage[]): CanvasItem[] {
  const canvases: CanvasItem[] = [];

  messages.forEach((msg, idx) => {
    if (msg.type !== 'text') return;
    const content = msg.content || '';
    if (!content) return;

    // Skip if any block is still streaming
    if (hasIncompleteHtmlBlock(content)) return;
    if (hasIncompleteBlock(content)) return;

    const re = /```canvas:html\s*\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    let htmlIdx = 0;
    while ((match = re.exec(content)) !== null) {
      const html = match[1].trim();
      if (html) {
        canvases.push({
          id: `canvas-${idx}-${htmlIdx}`,
          html,
          title: '画布',
          messageIndex: idx,
        });
        htmlIdx++;
      }
    }
  });

  return canvases;
}
