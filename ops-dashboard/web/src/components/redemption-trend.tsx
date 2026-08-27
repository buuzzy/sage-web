import ReactECharts from 'echarts-for-react';
import type { DailyPoint } from '../api';
import { useChartTokens } from '../theme';

export function RedemptionTrend({ data }: { data: DailyPoint[] }) {
  const t = useChartTokens();
  const total = data.reduce((s, d) => s + d.count, 0);
  const option = {
    grid: { left: 40, right: 16, top: 30, bottom: 30 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category' as const,
      data: data.map((d) => d.date.slice(5)),
      axisLabel: { color: t.textMuted, fontSize: 10 },
      axisLine: { lineStyle: { color: t.axisLine } },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: t.textMuted, fontSize: 10 },
      splitLine: { lineStyle: { color: t.splitLine } },
    },
    series: [
      {
        name: '兑换',
        type: 'bar' as const,
        data: data.map((d) => d.count),
        itemStyle: {
          color: t.series1,
          borderRadius: [4, 4, 0, 0],
        },
        barMaxWidth: 14,
      },
    ],
  };

  return (
    <section
      className="rounded-xl border p-4"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border)' }}
    >
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold">近 30 天兑换</h2>
        <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          共 {total} 次
        </span>
      </header>
      <ReactECharts
        option={option}
        style={{ height: 260, width: '100%' }}
        opts={{ renderer: 'svg' }}
        notMerge
      />
    </section>
  );
}