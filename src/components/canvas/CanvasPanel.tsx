import { useEffect, useState, type ComponentType } from 'react';
import type { CanvasItem } from '@/shared/lib/canvasExtract';
import { cn } from '@/shared/lib/utils';
import { ChevronLeft, ChevronRight, PanelRight, X } from 'lucide-react';

import { ErrorBoundary } from '@/components/error-boundary';

type HtmlCanvasComponent = ComponentType<{ html: string }>;

let htmlCanvasPromise: Promise<HtmlCanvasComponent> | null = null;

function loadHtmlCanvas(): Promise<HtmlCanvasComponent> {
  if (!htmlCanvasPromise) {
    htmlCanvasPromise = import('./HtmlCanvas').then(
      ({ HtmlCanvas }) => HtmlCanvas
    );
  }

  return htmlCanvasPromise;
}

export function preloadHtmlCanvas(): void {
  void loadHtmlCanvas().catch(() => undefined);
}

interface CanvasPanelProps {
  canvases: CanvasItem[];
  onClose: () => void;
  className?: string;
}

function CanvasLoading() {
  return (
    <div aria-busy="true" className="flex size-full flex-col gap-4 p-4">
      <div className="bg-muted h-5 w-1/3 animate-pulse rounded-md" />
      <div className="bg-muted size-full animate-pulse rounded-xl" />
      <span className="sr-only">画布加载中</span>
    </div>
  );
}

function CanvasRuntime({ html }: { html: string }) {
  const [HtmlCanvas, setHtmlCanvas] = useState<HtmlCanvasComponent>();
  const [loadError, setLoadError] = useState<Error>();
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadError(undefined);

    loadHtmlCanvas()
      .then((component) => {
        if (active) setHtmlCanvas(component);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error ? error : new Error('画布运行时加载失败')
          );
        }
      });

    return () => {
      active = false;
    };
  }, [retryToken]);

  if (loadError) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-foreground text-sm font-medium">画布加载失败</p>
        <p className="text-muted-foreground max-w-xs text-xs">
          {loadError.message || '画布运行时未能加载，请稍后重试。'}
        </p>
        <button
          type="button"
          onClick={() => {
            htmlCanvasPromise = null;
            setRetryToken((token) => token + 1);
          }}
          className="border-border hover:bg-accent rounded-lg border px-3 py-1.5 text-sm transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  if (!HtmlCanvas) {
    return <CanvasLoading />;
  }

  return <HtmlCanvas html={html} />;
}

export function CanvasPanel({
  canvases,
  onClose,
  className,
}: CanvasPanelProps) {
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
  }, [canvases]);

  const selected = canvases[Math.min(selectedIndex, canvases.length - 1)];

  return (
    <div
      className={cn(
        'bg-background flex h-full flex-col overflow-hidden',
        className
      )}
    >
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
            <span
              className="text-muted-foreground text-xs tabular-nums"
              title={`第 ${selected?.turnIndex || 1} 轮对话`}
            >
              {selectedIndex + 1}/{canvases.length}
            </span>
            <button
              onClick={() =>
                setSelectedIndex((i) => Math.min(canvases.length - 1, i + 1))
              }
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
          <ErrorBoundary
            key={selected.id}
            fallback={(error, reset) => (
              <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-foreground text-sm font-medium">
                  画布渲染失败
                </p>
                <p className="text-muted-foreground max-w-xs text-xs">
                  {error.message || '画布内容发生运行时错误，请稍后重试。'}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="border-border hover:bg-accent rounded-lg border px-3 py-1.5 text-sm transition-colors"
                >
                  重试
                </button>
              </div>
            )}
          >
            <CanvasRuntime html={selected.html} />
          </ErrorBoundary>
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            暂无画布
          </div>
        )}
      </div>
    </div>
  );
}
