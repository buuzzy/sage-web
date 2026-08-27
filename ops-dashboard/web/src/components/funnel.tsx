import type { FunnelStep as FunnelStepT } from '../api';
import { formatPct } from '../api';

export function Funnel({ funnel }: { funnel: FunnelStepT[] }) {
  const max = funnel[0]?.count ?? 0;

  return (
    <section
      className="rounded-xl border p-4"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border)' }}
    >
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold">核心漏斗</h2>
        <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          注册 → 激活 → 首次提问 → 次日回访 → 7 日留存
        </span>
      </header>
      <div className="space-y-2">
        {funnel.map((step, idx) => {
          const widthPct = max > 0 ? (step.count / max) * 100 : 0;
          return (
            <div key={step.key} className="grid grid-cols-[100px_1fr_auto] items-center gap-3">
              <div className="text-sm" style={{ color: 'var(--ink-secondary)' }}>
                {step.label}
              </div>
              <div
                className="h-7 rounded relative overflow-hidden"
                style={{ background: 'var(--surface-elevated)' }}
              >
                <div
                  className="h-full rounded transition-all"
                  style={{
                    width: `${widthPct}%`,
                    background:
                      idx === 0
                        ? 'var(--series-1)'
                        : 'color-mix(in oklab, var(--series-1) 65%, transparent)',
                  }}
                />
              </div>
              <div className="text-right text-sm tabular-nums" style={{ color: 'var(--ink-primary)' }}>
                {step.count}
                {idx > 0 && (
                  <span className="ml-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
                    → {formatPct(step.fromPrevious)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {max === 0 && (
        <p className="mt-3 text-xs" style={{ color: 'var(--ink-muted)' }}>
          暂无数据。
        </p>
      )}
    </section>
  );
}