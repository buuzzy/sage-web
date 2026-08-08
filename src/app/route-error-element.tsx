import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { reportError } from '@/shared/sync';

export function RouteErrorElement() {
  const error = useRouteError() as Error;

  useEffect(() => {
    void reportError({
      error_type: 'crash',
      message: error?.message || 'Route-level error',
      stack_trace: error?.stack,
      context: {
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      },
    });
  }, [error]);

  return (
    <div className="bg-background flex min-h-svh items-center justify-center p-6">
      <div className="border-border bg-card w-full max-w-md rounded-2xl border p-6 shadow-md">
        <h1 className="text-foreground text-lg font-semibold">出了点小问题</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          我们已经收到自动报告，稍后会排查这个问题。你可以尝试刷新继续使用。
        </p>
        <details className="text-muted-foreground mt-4 text-xs">
          <summary className="cursor-pointer select-none">技术细节</summary>
          <pre className="bg-muted mt-2 max-h-40 overflow-auto rounded p-2 text-[11px] leading-relaxed">
            {error?.message || String(error)}
            {error?.stack ? `\n\n${error.stack}` : ''}
          </pre>
        </details>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => window.location.reload()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    </div>
  );
}
