import type { AdminMetrics } from '../api';
import { formatShanghaiDateTime, relativeDays } from '../api';

function List({
  title,
  items,
  emptyText,
}: {
  title: string;
  emptyText: string;
  items: Array<{ primary: string; secondary?: string; meta?: string }>;
}) {
  return (
    <div>
      <h3 className="text-xs mb-2" style={{ color: 'var(--ink-muted)' }}>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs py-6 text-center" style={{ color: 'var(--ink-muted)' }}>
          {emptyText}
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {items.map((it, idx) => (
            <li key={idx} className="py-2 flex items-baseline gap-2">
              <span
                className="font-mono text-sm tabular-nums shrink-0"
                style={{ color: 'var(--ink-primary)' }}
              >
                {it.primary}
              </span>
              {it.secondary && (
                <span className="text-xs truncate" style={{ color: 'var(--ink-secondary)' }}>
                  {it.secondary}
                </span>
              )}
              {it.meta && (
                <span
                  className="ml-auto text-xs shrink-0 tabular-nums"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  {it.meta}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RecentActivity({
  profiles,
  redemptions,
}: {
  profiles: AdminMetrics['recentProfiles'];
  redemptions: AdminMetrics['recentRedemptions'];
}) {
  return (
    <section
      className="rounded-xl border p-4"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border)' }}
    >
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold">最近动态</h2>
        <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          邮箱已脱敏
        </span>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <List
          title="最近注册"
          emptyText="暂无注册"
          items={profiles.map((p) => ({
            primary: p.email,
            secondary: p.displayName ?? undefined,
            meta: `${formatShanghaiDateTime(p.createdAt)} (${relativeDays(p.createdAt)})`,
          }))}
        />
        <List
          title="最近兑换"
          emptyText="暂无兑换"
          items={redemptions.map((r) => ({
            primary: r.code,
            secondary: r.email,
            meta: `${formatShanghaiDateTime(r.redeemedAt)} (${relativeDays(r.redeemedAt)})`,
          }))}
        />
      </div>
    </section>
  );
}