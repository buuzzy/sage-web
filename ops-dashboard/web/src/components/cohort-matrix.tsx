import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { CohortRow as CohortRowT } from '../api';
import { formatPct } from '../api';

function rateColor(rate: number | null): string | undefined {
  if (rate === null) return undefined;
  if (rate >= 0.4) return 'var(--status-good)';
  if (rate <= 0.1) return 'var(--status-warning)';
  return undefined;
}

export function CohortMatrix({ cohorts }: { cohorts: CohortRowT[] }) {
  const columns: ColumnsType<CohortRowT> = [
    {
        title: '激活周',
        dataIndex: 'weekStart',
        key: 'weekStart',
        render: (v: string) => v.slice(5),
        width: 90,
      },
      {
        title: '人数',
        dataIndex: 'size',
        key: 'size',
        width: 70,
        render: (v: number) => <span className="tabular-nums">{v}</span>,
      },
      {
        title: 'W0',
        key: 'w0',
        width: 90,
        render: (_, r) => {
          const w = r.weeks[0];
          return (
            <span className="tabular-nums" style={{ color: rateColor(w.rate) }}>
              {w.active} ({formatPct(w.rate)})
            </span>
          );
        },
      },
      {
        title: 'W1',
        key: 'w1',
        width: 90,
        render: (_, r) => {
          const w = r.weeks[1];
          return w.future ? <span style={{ color: 'var(--ink-muted)' }}>—</span> : (
            <span className="tabular-nums" style={{ color: rateColor(w.rate) }}>
              {w.active} ({formatPct(w.rate)})
            </span>
          );
        },
      },
      {
        title: 'W2',
        key: 'w2',
        width: 90,
        render: (_, r) => {
          const w = r.weeks[2];
          return w.future ? <span style={{ color: 'var(--ink-muted)' }}>—</span> : (
            <span className="tabular-nums" style={{ color: rateColor(w.rate) }}>
              {w.active} ({formatPct(w.rate)})
            </span>
          );
        },
      },
      {
        title: 'W3',
        key: 'w3',
        width: 90,
        render: (_, r) => {
          const w = r.weeks[3];
          return w.future ? <span style={{ color: 'var(--ink-muted)' }}>—</span> : (
            <span className="tabular-nums" style={{ color: rateColor(w.rate) }}>
              {w.active} ({formatPct(w.rate)})
            </span>
          );
        },
      },
      {
        title: 'W4',
        key: 'w4',
        width: 90,
        render: (_, r) => {
          const w = r.weeks[4];
          return w.future ? <span style={{ color: 'var(--ink-muted)' }}>—</span> : (
            <span className="tabular-nums" style={{ color: rateColor(w.rate) }}>
              {w.active} ({formatPct(w.rate)})
            </span>
          );
        },
      },
  ];

  return (
    <section
      className="rounded-xl border p-4"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border)' }}
    >
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold">留存 Cohort</h2>
        <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          按激活周分组（周一为周开始）· ≥40% 绿、≤10% 黄
        </span>
      </header>
      <Table<CohortRowT>
        rowKey="weekStart"
        columns={columns}
        dataSource={cohorts}
        size="small"
        pagination={false}
        locale={{ emptyText: '暂无 cohort' }}
      />
    </section>
  );
}