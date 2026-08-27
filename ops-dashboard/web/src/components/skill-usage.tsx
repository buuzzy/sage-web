import ReactECharts from 'echarts-for-react';
import { useChartTokens } from '../theme';

interface Item { name: string; count: number }

function HorizontalBars({ items, color }: { items: Item[]; color: string }) {
  const t = useChartTokens();
  const labels = items.map((i) => i.name);
  const values = items.map((i) => i.count);

  const option = {
    grid: { left: 90, right: 30, top: 8, bottom: 20 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'value' as const,
      axisLabel: { color: t.textMuted, fontSize: 10 },
      splitLine: { lineStyle: { color: t.splitLine } },
    },
    yAxis: {
      type: 'category' as const,
      data: labels,
      inverse: true,
      axisLabel: { color: t.textSecondary, fontSize: 11 },
      axisLine: { lineStyle: { color: t.axisLine } },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar' as const,
        data: values,
        itemStyle: { color, borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 14,
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: Math.max(160, items.length * 28 + 40), width: '100%' }}
      opts={{ renderer: 'svg' }}
      notMerge
    />
  );
}

export function SkillUsage({
  skills,
  assets,
}: {
  skills: Array<{ name: string; count: number }>;
  assets: Array<{ code: string; count: number }>;
}) {
  const t = useChartTokens();

  return (
    <section
      className="rounded-xl border p-4"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border)' }}
    >
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold">功能使用分布</h2>
        <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          来自 user_behavior（近 90 天）
        </span>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-xs mb-2" style={{ color: 'var(--ink-muted)' }}>
            技能使用 Top {skills.length}
          </h3>
          {skills.length > 0 ? (
            <HorizontalBars items={skills} color={t.series1} />
          ) : (
            <p className="text-xs py-8 text-center" style={{ color: 'var(--ink-muted)' }}>
              暂无数据
            </p>
          )}
        </div>
        <div>
          <h3 className="text-xs mb-2" style={{ color: 'var(--ink-muted)' }}>
            标的提及 Top {assets.length}
          </h3>
          {assets.length > 0 ? (
            <HorizontalBars items={assets.map((a) => ({ name: a.code, count: a.count }))} color={t.series2} />
          ) : (
            <p className="text-xs py-8 text-center" style={{ color: 'var(--ink-muted)' }}>
              暂无数据
            </p>
          )}
        </div>
      </div>
    </section>
  );
}