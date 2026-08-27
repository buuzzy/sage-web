import type { AdminOverview } from '../api';
import { formatPct } from '../api';

export function StatCards({ overview }: { overview: AdminOverview }) {
  const tiles: Array<{ label: string; value: string | number; sub?: string }> = [
    { label: '累计注册', value: overview.totalRegistered },
    {
      label: '已激活',
      value: overview.activated,
      sub: `激活率 ${formatPct(overview.activationRate)}`,
    },
    { label: '今日新增', value: overview.newToday },
    { label: '今日兑换', value: overview.redeemedToday },
    { label: '今日 DAU', value: overview.dauToday },
    { label: '近 7 天提问', value: overview.messages7d },
    { label: '生效兑换码', value: overview.activeCodes },
  ];

  return (
    <section
      className="rounded-xl border p-4"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border)' }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        {tiles.map((t) => (
          <div key={t.label}>
            <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>
              {t.label}
            </div>
            <div
              className="mt-1 text-2xl font-semibold tabular-nums"
              style={{ color: 'var(--ink-primary)' }}
            >
              {t.value}
            </div>
            {t.sub && (
              <div className="text-xs" style={{ color: 'var(--ink-secondary)' }}>
                {t.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}