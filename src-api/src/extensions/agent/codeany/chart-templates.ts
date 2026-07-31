/**
 * Server-side ECharts HTML generators.
 *
 * Each function takes a ParsedDataset (from data-cache) plus chart options,
 * and produces a complete HTML fragment compatible with HtmlCanvas.tsx:
 *   - No <html>/<head>/<body> wrapper (HtmlCanvas adds those)
 *   - Uses the `echarts` global (HtmlCanvas loads it)
 *   - Uses CSS variables for theming
 *
 * Data is embedded as JSON in the script — never transcribed by the LLM.
 */

import { type ParsedDataset, parseNum, findCol } from './data-cache';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(d: string): string {
  // "20260521" -> "05-21"; pass through if already short
  if (/^\d{8}$/.test(d)) return `${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return d;
}

function fmtDateLong(d: string): string {
  if (/^\d{8}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return d;
}

function fmtVol(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(0)}万手`;
  return `${v.toFixed(0)}手`;
}

interface ChartOpts {
  title: string;
  subtitle?: string;
}

// ---------------------------------------------------------------------------
// Candlestick (K-line + volume)
// ---------------------------------------------------------------------------

export function generateCandlestickHTML(
  data: ParsedDataset,
  opts: ChartOpts
): string {
  const dateCol = findCol(data, ['日期', 'trade_date', 'date']);
  const openCol = findCol(data, ['开盘', 'open']);
  const highCol = findCol(data, ['最高', 'high']);
  const lowCol = findCol(data, ['最低', 'low']);
  const closeCol = findCol(data, ['收盘', 'close']);
  const volCol = findCol(data, ['成交量', 'vol']);
  const pctCol = findCol(data, ['涨跌幅', 'pct_chg']);

  // Fallback to table if OHLC columns are missing
  if (!openCol || !highCol || !lowCol || !closeCol) {
    return generateTableHTML(data, opts);
  }

  // Extract rows with parsed numbers
  const rows = data.rows.map((r) => ({
    d: dateCol ? r[dateCol] || '' : '',
    o: parseNum(r[openCol]) ?? 0,
    h: parseNum(r[highCol]) ?? 0,
    l: parseNum(r[lowCol]) ?? 0,
    c: parseNum(r[closeCol]) ?? 0,
    v: volCol ? parseNum(r[volCol]) ?? 0 : 0,
    p: pctCol ? parseNum(r[pctCol]) ?? 0 : 0,
  }));

  // Meta info
  const firstDate = rows.length > 0 ? fmtDateLong(rows[0].d) : '';
  const lastDate = rows.length > 0 ? fmtDateLong(rows[rows.length - 1].d) : '';
  const lastClose = rows.length > 0 ? rows[rows.length - 1].c : 0;
  const minLow = rows.length > 0 ? Math.min(...rows.map((r) => r.l)) : 0;
  const maxHigh = rows.length > 0 ? Math.max(...rows.map((r) => r.h)) : 0;
  const minLowRow = rows.find((r) => r.l === minLow);
  const maxHighRow = rows.find((r) => r.h === maxHigh);

  const chartData = JSON.stringify(rows);

  const titleHtml = escapeHtml(opts.title);
  const subtitleHtml = opts.subtitle ? escapeHtml(opts.subtitle) : '';

  return `<style>
  .chart-panel { padding: 12px; }
  .chart-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .chart-subtitle { font-size: 11px; color: var(--muted-foreground); margin-bottom: 8px; }
  .chart-meta { display: flex; gap: 16px; font-size: 11px; color: var(--muted-foreground); margin-bottom: 8px; flex-wrap: wrap; }
  .chart-meta b { color: var(--foreground); font-size: 13px; }
  .chart-legend { display: flex; gap: 16px; margin-top: 8px; font-size: 11px; color: var(--muted-foreground); flex-wrap: wrap; }
  .chart-legend span { display: inline-flex; align-items: center; }
  .swatch { display: inline-block; width: 10px; height: 10px; margin-right: 4px; border-radius: 2px; }
</style>
<div class="chart-panel">
  <div class="chart-title">${titleHtml}</div>
  ${subtitleHtml ? `<div class="chart-subtitle">${subtitleHtml}</div>` : ''}
  <div class="chart-meta">
    <span>区间：${firstDate} 至 ${lastDate}</span>
    <span>最新收盘：<b>${lastClose.toFixed(2)}</b></span>
    <span>区间最低：<b>${minLow.toFixed(2)}</b>(${minLowRow ? fmtDate(minLowRow.d) : ''})</span>
    <span>区间最高：<b>${maxHigh.toFixed(2)}</b>(${maxHighRow ? fmtDate(maxHighRow.d) : ''})</span>
  </div>
  <div id="chart-kline" style="width:100%;height:420px;"></div>
  <div class="chart-legend">
    <span><span class="swatch" style="background:#26a69a;"></span>MA5</span>
    <span><span class="swatch" style="background:#ff9800;"></span>MA10</span>
    <span><span class="swatch" style="background:#7e57c2;"></span>MA20</span>
  </div>
</div>
<script>
(function() {
  var css = getComputedStyle(document.documentElement);
  var C_UP = css.getPropertyValue('--chart-2').trim() || '#26a69a';
  var C_DN = css.getPropertyValue('--chart-5').trim() || '#ef5350';
  var FG = css.getPropertyValue('--foreground').trim();
  var META = css.getPropertyValue('--muted-foreground').trim();
  var BORDER = css.getPropertyValue('--border').trim();
  var BG = css.getPropertyValue('--background').trim();

  var raw = ${chartData};

  var dates = raw.map(function(r) { return r.d; });
  // ECharts candlestick expects [open, close, low, high]
  var ohlc = raw.map(function(r) { return [r.o, r.c, r.l, r.h]; });
  var vols = raw.map(function(r) {
    return { value: r.v, itemStyle: { color: r.c >= r.o ? C_UP : C_DN } };
  });

  function ma(arr, n) {
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      if (i < n - 1) { out.push('-'); continue; }
      var s = 0;
      for (var j = 0; j < n; j++) s += arr[i - j];
      out.push(+(s / n).toFixed(2));
    }
    return out;
  }
  var closes = raw.map(function(r) { return r.c; });
  var ma5 = ma(closes, 5);
  var ma10 = ma(closes, 10);
  var ma20 = ma(closes, 20);

  var el = document.getElementById('chart-kline');
  var chart = echarts.init(el);
  chart.setOption({
    grid: [
      { left: 50, right: 50, top: 15, height: 280 },
      { left: 50, right: 50, top: 315, height: 70 }
    ],
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    xAxis: [
      { type: 'category', data: dates, gridIndex: 0, boundaryGap: false,
        axisLabel: { color: META, fontSize: 11 },
        axisLine: { lineStyle: { color: BORDER } },
        splitLine: { show: false } },
      { type: 'category', data: dates, gridIndex: 1,
        axisLabel: { show: false },
        axisLine: { lineStyle: { color: BORDER } },
        splitLine: { show: false } }
    ],
    yAxis: [
      { gridIndex: 0, scale: true,
        axisLabel: { color: META, fontSize: 11 },
        splitLine: { lineStyle: { color: BORDER, type: 'dashed' } },
        axisLine: { show: false } },
      { gridIndex: 1, scale: true,
        axisLabel: { color: META, fontSize: 11 },
        splitLine: { lineStyle: { color: BORDER, type: 'dashed' } },
        axisLine: { show: false } }
    ],
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'cross' },
      backgroundColor: BG, borderColor: BORDER,
      textStyle: { color: FG, fontSize: 12 },
      formatter: function(p) {
        var i = p[0].dataIndex;
        var r = raw[i];
        var fmtV = r.v >= 10000 ? (r.v / 10000).toFixed(0) + '万手' : r.v.toFixed(0) + '手';
        return '<b>' + r.d + '</b><br/>'
          + '开 ' + r.o.toFixed(2) + '  高 ' + r.h.toFixed(2) + '  低 ' + r.l.toFixed(2) + '  收 <b>' + r.c.toFixed(2) + '</b><br/>'
          + '涨跌幅 ' + r.p + '%  量 ' + fmtV;
      }
    },
    series: [
      { type: 'candlestick', data: ohlc, xAxisIndex: 0, yAxisIndex: 0,
        itemStyle: { color: C_UP, color0: C_DN, borderColor: C_UP, borderColor0: C_DN } },
      { type: 'line', data: ma5, smooth: true, xAxisIndex: 0, yAxisIndex: 0,
        lineStyle: { width: 1, color: '#26a69a' }, symbol: 'none' },
      { type: 'line', data: ma10, smooth: true, xAxisIndex: 0, yAxisIndex: 0,
        lineStyle: { width: 1, color: '#ff9800' }, symbol: 'none' },
      { type: 'line', data: ma20, smooth: true, xAxisIndex: 0, yAxisIndex: 0,
        lineStyle: { width: 1, color: '#7e57c2' }, symbol: 'none' },
      { type: 'bar', data: vols, xAxisIndex: 1, yAxisIndex: 1 }
    ]
  });
  new ResizeObserver(function() { chart.resize(); }).observe(el);
})();
</script>`;
}

// ---------------------------------------------------------------------------
// Line chart (for time-series metrics like PE/PB/ROE)
// ---------------------------------------------------------------------------

const LINE_COLORS = ['#5b8ff9', '#5ad8a6', '#5d7092', '#f6bd16', '#e86452'];

export function generateLineHTML(
  data: ParsedDataset,
  opts: ChartOpts & { series?: string[] }
): string {
  // Find x-axis column (date-like)
  const xCol =
    findCol(data, ['日期', '报告期', 'trade_date', 'end_date', 'date', 'ann_date']) ||
    data.columns[0];

  if (!xCol) return generateTableHTML(data, opts);

  // Determine which columns to plot
  const skipCols = new Set([xCol, '代码', 'ts_code', '股票代码']);
  let seriesCols: string[];
  if (opts.series && opts.series.length > 0) {
    // Use LLM-specified series, filtered to columns that exist
    seriesCols = opts.series.filter((s) => data.columns.includes(s));
  } else {
    // Auto-select: numeric columns, skip code/date, limit to 5
    seriesCols = data.columns.filter((c) => {
      if (skipCols.has(c)) return false;
      return data.rows.some((r) => parseNum(r[c]) !== null);
    });
    // Prioritize commonly interesting metrics
    const priority = ['PE', 'PB', 'PE(TTM)', 'ROE', '毛利率', '净利率', '资产负债率', '换手率'];
    seriesCols.sort((a, b) => {
      const ai = priority.indexOf(a);
      const bi = priority.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return 0;
    });
    seriesCols = seriesCols.slice(0, 5);
  }

  if (seriesCols.length === 0) return generateTableHTML(data, opts);

  // Extract data
  const xValues = data.rows.map((r) => r[xCol] || '');
  const seriesData = seriesCols.map((col) => ({
    name: col,
    data: data.rows.map((r) => parseNum(r[col])),
  }));

  const titleHtml = escapeHtml(opts.title);
  const chartData = JSON.stringify({ x: xValues, series: seriesData });
  const legendItems = seriesCols
    .map(
      (s, i) =>
        `<span><span class="swatch" style="background:${LINE_COLORS[i % LINE_COLORS.length]};"></span>${escapeHtml(s)}</span>`
    )
    .join('\n    ');

  return `<style>
  .chart-panel { padding: 12px; }
  .chart-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
  .chart-legend { display: flex; gap: 16px; margin-top: 8px; font-size: 11px; color: var(--muted-foreground); flex-wrap: wrap; }
  .chart-legend span { display: inline-flex; align-items: center; }
  .swatch { display: inline-block; width: 10px; height: 10px; margin-right: 4px; border-radius: 2px; }
</style>
<div class="chart-panel">
  <div class="chart-title">${titleHtml}</div>
  <div id="chart-line" style="width:100%;height:400px;"></div>
  <div class="chart-legend">
    ${legendItems}
  </div>
</div>
<script>
(function() {
  var css = getComputedStyle(document.documentElement);
  var FG = css.getPropertyValue('--foreground').trim();
  var META = css.getPropertyValue('--muted-foreground').trim();
  var BORDER = css.getPropertyValue('--border').trim();
  var BG = css.getPropertyValue('--background').trim();

  var d = ${chartData};
  var COLORS = ${JSON.stringify(LINE_COLORS)};

  var series = d.series.map(function(s, i) {
    return {
      name: s.name,
      type: 'line',
      data: s.data,
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2, color: COLORS[i % COLORS.length] },
      itemStyle: { color: COLORS[i % COLORS.length] },
      connectNulls: true
    };
  });

  var el = document.getElementById('chart-line');
  var chart = echarts.init(el);
  chart.setOption({
    grid: { left: 60, right: 30, top: 20, bottom: 50 },
    xAxis: {
      type: 'category',
      data: d.x,
      axisLabel: { color: META, fontSize: 11, rotate: 30 },
      axisLine: { lineStyle: { color: BORDER } },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: META, fontSize: 11 },
      splitLine: { lineStyle: { color: BORDER, type: 'dashed' } },
      axisLine: { show: false }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: BG, borderColor: BORDER,
      textStyle: { color: FG, fontSize: 12 }
    },
    legend: { show: false },
    series: series
  });
  new ResizeObserver(function() { chart.resize(); }).observe(el);
})();
</script>`;
}

// ---------------------------------------------------------------------------
// Table (for financial statements, lists, etc.)
// ---------------------------------------------------------------------------

export function generateTableHTML(
  data: ParsedDataset,
  opts: ChartOpts
): string {
  const { columns, rows } = data;

  // For wide datasets (many columns, few rows), transpose: metrics as rows,
  // periods as columns. This is common for financial statements.
  const shouldTranspose = columns.length > 6 && rows.length <= 8;

  const titleHtml = escapeHtml(opts.title);

  if (shouldTranspose) {
    // Transposed: each original column becomes a row, each original row becomes a column
    const periodLabels = rows.map((r) => {
      const dateCol = findCol(data, ['报告期', '日期', 'end_date', 'trade_date', 'ann_date']);
      return dateCol ? r[dateCol] || '' : '';
    });

    const metricCols = columns.filter(
      (c) => !['报告期', '日期', 'end_date', 'trade_date', 'ann_date', '代码', 'ts_code'].includes(c)
    );

    const headerCells = ['指标', ...periodLabels]
      .map((h) => `<th>${escapeHtml(h)}</th>`)
      .join('');

    const bodyRows = metricCols
      .map((metric) => {
        const cells = rows.map((r) => {
          const raw = r[metric] || '';
          const num = parseNum(raw);
          if (num !== null) {
            // Format large numbers
            if (Math.abs(num) >= 100000000) return `<td>${(num / 100000000).toFixed(2)}亿</td>`;
            if (Math.abs(num) >= 10000) return `<td>${(num / 10000).toFixed(2)}万</td>`;
            return `<td>${num.toFixed(2)}</td>`;
          }
          return `<td>${escapeHtml(raw)}</td>`;
        });
        return `<tr><td class="metric-name">${escapeHtml(metric)}</td>${cells.join('')}</tr>`;
      })
      .join('');

    return `<style>
  .chart-panel { padding: 12px; }
  .chart-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .data-table th { text-align: right; padding: 6px 10px; color: var(--muted-foreground); font-weight: 500; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .data-table th:first-child { text-align: left; }
  .data-table td { text-align: right; padding: 6px 10px; border-bottom: 1px solid var(--border); }
  .data-table td.metric-name { text-align: left; color: var(--muted-foreground); }
  .data-table tr:hover td { background: var(--accent); }
</style>
<div class="chart-panel">
  <div class="chart-title">${titleHtml}</div>
  <table class="data-table">
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</div>`;
  }

  // Normal table: each row is a data row, columns are columns
  const headerCells = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const bodyRows = rows
    .map((r) => {
      const cells = columns.map((c) => `<td>${escapeHtml(r[c] || '')}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<style>
  .chart-panel { padding: 12px; }
  .chart-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .data-table th { text-align: left; padding: 6px 10px; color: var(--muted-foreground); font-weight: 500; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .data-table td { padding: 6px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .data-table tr:hover td { background: var(--accent); }
</style>
<div class="chart-panel">
  <div class="chart-title">${titleHtml}</div>
  <div style="overflow-x:auto;">
    <table class="data-table">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>
</div>`;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function generateChartHTML(
  chartType: string,
  data: ParsedDataset,
  opts: ChartOpts & { series?: string[] }
): string {
  switch (chartType) {
    case 'candlestick':
      return generateCandlestickHTML(data, opts);
    case 'line':
      return generateLineHTML(data, opts);
    case 'table':
      return generateTableHTML(data, opts);
    default:
      return generateTableHTML(data, opts);
  }
}
