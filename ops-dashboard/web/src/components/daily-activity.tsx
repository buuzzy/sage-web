import ReactECharts from 'echarts-for-react';
import type { ActivityPoint } from '../api';
import { useChartTokens } from '../theme';

// 双指标不同量级（DAU 是人数、提问数是条数）→ 拆成两个单轴小图，
// 不做双 Y 轴（dataviz 规则：one axis）。
function LineMini({
  title,
  dates,
  values,
  color,
}: {
  title: string;
  dates: string[];
  values: number[];
  color: string;
}) {
  const t = useChartTokens();
  const option = {
    grid: { left: 40, right: 16, top: 28, bottom: 28 },
    tooltip: { trigger: 'axis' as const },
    xAxis: {
      type: 'category' as const,
      data: dates,
      axisLabel: { color: t.textMuted, fontSize: 10 },
      axisLine: { lineStyle: { color: t.axisLine } },
    },
    yAxis: {
      type: 'value' as const,
      minInterval: 1,
      axisLabel: { color: t.textMuted, fontSize: 10 },
      splitLine: { lineStyle: { color: t.splitLine } },
    },
    series: [
      {
        name: title,
        type: 'line' as const,
        smooth: true,
        symbolSize: 6,
        itemStyle: { color },
        lineStyle: { width: 2, color },
        data: values,
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 240, width: '100%' }}
      opts={{ renderer: 'svg' }}
      notMerge
    />
  );
}

export function DailyActivity({ data }: { data: ActivityPoint[] }) {
  const t = useChartTokens();
  const dates = data.map((d) => d.date.slice(5));

  return (
    <section
      className="rounded-xl border p-4"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border)' }}
    >
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold">近 30 天活跃趋势</h2>
        <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          DAU（左图）与每日提问数（右图）
        </span>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-xs mb-1" style={{ color: 'var(--ink-muted)' }}>
            DAU
          </h3>
          <LineMini title="DAU" dates={dates} values={data.map((d) => d.dau)} color={t.series1} />
        </div>
        <div>
          <h3 className="text-xs mb-1" style={{ color: 'var(--ink-muted)' }}>
            提问数
          </h3>
          <LineMini
            title="提问数"
            dates={dates}
            values={data.map((d) => d.messages)}
            color={t.series2}
          />
        </div>
      </div>
    </section>
  );
}