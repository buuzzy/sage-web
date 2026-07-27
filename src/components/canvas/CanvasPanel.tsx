import { useEffect, useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { ChevronLeft, ChevronRight, PanelRight, X } from 'lucide-react';

import type { CanvasItem } from '@/shared/lib/canvasExtract';

import { HtmlCanvas } from './HtmlCanvas';

interface CanvasPanelProps {
  canvases: CanvasItem[];
  onClose: () => void;
  className?: string;
}

export function CanvasPanel({ canvases, onClose, className }: CanvasPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (canvases.length > 0) {
      // Jump to the latest canvas from the most recent turn
      const latestTurn = canvases[canvases.length - 1].turnIndex;
      const lastInTurn = canvases
        .map((c, i) => ({ c, i }))
        .filter((x) => x.c.turnIndex === latestTurn)
        .pop();
      setSelectedIndex(lastInTurn ? lastInTurn.i : canvases.length - 1);
    }
  }, [canvases.length, canvases[canvases.length - 1]?.turnIndex]);

  const selected = canvases[Math.min(selectedIndex, canvases.length - 1)];

  return (
    <div className={cn('bg-background flex h-full flex-col overflow-hidden', className)}>
      <div className="border-border/50 bg-muted/30 flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <PanelRight className="text-muted-foreground size-4 shrink-0" />
        <span className="text-foreground flex-1 truncate text-sm font-medium">
          画布
        </span>
        {canvases.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
              disabled={selectedIndex === 0}
              className="hover:bg-accent hover:text-foreground text-muted-foreground rounded p-1 transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-muted-foreground text-xs tabular-nums" title={`第 ${selected?.turnIndex || 1} 轮对话`}>
              {selectedIndex + 1}/{canvases.length}
            </span>
            <button
              onClick={() => setSelectedIndex((i) => Math.min(canvases.length - 1, i + 1))}
              disabled={selectedIndex >= canvases.length - 1}
              className="hover:bg-accent hover:text-foreground text-muted-foreground rounded p-1 transition-colors disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
        <button
          onClick={onClose}
          className="hover:bg-accent hover:text-foreground text-muted-foreground rounded p-1 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="scrollbar-soft flex-1 overflow-hidden">
        {selected?.html ? (
          <HtmlCanvas html={selected.html} />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            暂无画布
          </div>
        )}
      </div>
    </div>
  );
}
