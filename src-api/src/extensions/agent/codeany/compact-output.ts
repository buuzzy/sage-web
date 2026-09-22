/**
 * 紧凑模式输出改写（2026-09-21 Q4 后架构升级）。
 *
 * 背景：MCP 数据工具一次返回几十到几百行 `key:value | key:value` 表格，
 * LLM 逐行"阅读"的边际价值趋近于零——Q1-Q4 实测中模型从未读错表格行，
 * 翻车的全是它对行数据做"眼算"的派生统计（中位数、窗口对比等）。
 * 让几百行 OHLC 进入模型上下文，只会烧 token 并诱发眼算幻觉。
 *
 * 方案：PostToolUse 拦截器本就是中间人——完整输出解析进 data-cache 后，
 * 把 LLM 可见正文改写为「首尾锚点行 + 逐列统计（最新/极值@日期/中位数/
 * 最新分位）」，中间数据行不再进入模型上下文。画图走 data_key 缓存引用，
 * 与此前完全一致；需要逐日明细时缩小日期范围重新查询（钻取）。
 *
 * 本模块只做改写，不做缓存；MCP 侧零改动，其他 MCP 客户端不受影响，
 * 所有注册在 TOOL_CHART_TYPE 的数据工具一次性受益。
 */

import { parseNum, findCol, ParsedDataset } from './data-cache';
import { buildFactCard, FACT_CARD_HEADER } from './fact-card';

/** 数据行数达到该阈值才触发紧凑模式，短序列保持全量（叙事价值高、成本低）。 */
export const COMPACT_THRESHOLD = 40;

/** 判断一行原始输出是否为数据行（与 data-cache 解析器的行格式对齐）。 */
export function isDataRowLine(trimmed: string): boolean {
  if (!trimmed) return false;
  if (trimmed.startsWith('---')) return false;
  if (trimmed.startsWith('...')) return false;
  // 相关资讯行（2026-09-22，MCP 行情输出附带）：标题可能含冒号/竖线，
  // 不能落入数据行判定，否则紧凑模式会把它们当数据丢弃。
  if (trimmed.startsWith('📰')) return false;
  return trimmed.includes(':') && trimmed.includes('|');
}

/** 紧凑数值：与 MCP 侧 fmt_num 对齐，12.3400 -> 12.34，419.0 -> 419。 */
function fmtNum(n: number): string {
  if (!isFinite(n)) return String(n);
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  return n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

interface ColStats {
  col: string;
  latest: string;
  latestDate: string;
  max: string;
  maxDate: string;
  min: string;
  minDate: string;
  median: string;
  pctRank: string;
}

/** 对单个行组的一列计算统计；非数值列返回 null。 */
function computeColStats(
  col: string,
  rows: Record<string, string>[],
  dateCol: string | undefined
): ColStats | null {
  const pairs: Array<{ v: number; raw: string; date: string }> = [];
  for (const row of rows) {
    const raw = row[col];
    if (raw === undefined || raw === '') continue;
    const v = parseNum(raw);
    if (v === null) continue;
    pairs.push({ v, raw, date: dateCol ? (row[dateCol] ?? '') : '' });
  }
  // 数值覆盖率不足的列视为文本列（代码、名称等），不输出统计
  if (pairs.length < Math.max(3, rows.length * 0.8)) return null;

  const sorted = [...pairs].map((p) => p.v).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;

  let maxP = pairs[0];
  let minP = pairs[0];
  for (const p of pairs) {
    if (p.v > maxP.v) maxP = p;
    if (p.v < minP.v) minP = p;
  }
  const latestP = pairs[pairs.length - 1];
  const below = pairs.filter((p) => p.v < latestP.v).length;
  const pct = ((below / pairs.length) * 100).toFixed(1);

  return {
    col,
    latest: latestP.raw,
    latestDate: latestP.date,
    max: maxP.raw,
    maxDate: maxP.date,
    min: minP.raw,
    minDate: minP.date,
    median: fmtNum(median),
    pctRank: `${pct}%`,
  };
}

/** 日期列候选：取第一个命中（列名含"日期"或为 date）。 */
function findDateCol(columns: string[]): string | undefined {
  for (const c of columns) {
    if (c.includes('日期') || c.toLowerCase() === 'date') return c;
  }
  return undefined;
}

/** 代码分组列候选。 */
function findCodeCol(columns: string[]): string | undefined {
  for (const c of columns) {
    const lower = c.toLowerCase();
    if (c === '代码' || lower === 'ts_code' || lower === 'code' || lower === 'symbol')
      return c;
  }
  return undefined;
}

/**
 * 把长序列工具输出改写为紧凑正文。
 *
 * 保留：标题/声明/📊 统计行等非数据行原样；首尾两条数据行作锚点。
 * 新增：逐列统计块（按代码分组；最新@日期、最高@日期、最低@日期、
 * 中位数、最新分位），全部由代码计算——模型只引用、不眼算。
 * 丢弃：中间数据行（已在 data-cache 中，画图走 data_key）。
 */
export function buildCompactOutput(
  rawText: string,
  dataset: ParsedDataset,
  dataKey: string
): string {
  const lines = rawText.split('\n');
  const dataLineIdx: number[] = [];
  lines.forEach((line, i) => {
    if (isDataRowLine(line.trim())) dataLineIdx.push(i);
  });
  if (dataLineIdx.length < COMPACT_THRESHOLD) return rawText;

  const dateCol = findDateCol(dataset.columns);
  const codeCol = findCodeCol(dataset.columns);

  // 按代码分组（无代码列则单组）
  const groups = new Map<string, Record<string, string>[]>();
  if (codeCol) {
    for (const row of dataset.rows) {
      const g = row[codeCol] ?? '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(row);
    }
  } else {
    groups.set('', dataset.rows);
  }

  // 两道闸防误伤：
  // 1) 必须有日期列——财务报表等无日期列的表不做紧凑；
  // 2) 至少一个分组行数达阈值——trade_date 单日全市场截面（每行一只
  //    股票）不是时间序列，跨股票求中位数无意义，保持原样输出。
  if (!dateCol) return rawText;
  const statGroups = [...groups.entries()].filter(
    ([, rows]) => rows.length >= COMPACT_THRESHOLD
  );
  if (statGroups.length === 0) return rawText;

  const firstIdx = dataLineIdx[0];
  const lastIdx = dataLineIdx[dataLineIdx.length - 1];

  const statLines: string[] = [];
  for (const [code, rows] of statGroups) {
    const label = code ? `${code} ` : '';
    for (const col of dataset.columns) {
      if (col === dateCol || col === codeCol) continue;
      const st = computeColStats(col, rows, dateCol);
      if (!st) continue;
      const latest = st.latestDate ? `${st.latest}（${st.latestDate}）` : st.latest;
      statLines.push(
        `· ${label}${col}：最新 ${latest}｜最高 ${st.max}（${st.maxDate}）｜` +
          `最低 ${st.min}（${st.minDate}）｜中位数 ${st.median}｜最新分位 ${st.pctRank}`
      );
    }
  }

  const factLines = buildFactCard(dataset);

  const out: string[] = [];
  let anchorEmitted = false;
  lines.forEach((line, i) => {
    const isData = isDataRowLine(line.trim());
    // 旧截断说明（"仅显示前 N 条"）在紧凑模式下已失真，丢弃
    if (!isData && /^\.\.\. \(共/.test(line.trim())) return;
    // MCP 侧 📊 区间统计行在紧凑模式下冗余（2026-09-21 归一）：逐列统计
    // 已覆盖最新/最高/最低@日期且按列更全，保留会造成两处口径并存。
    // 仅紧凑路径丢弃；短序列（未触发紧凑）仍保留 MCP 原始统计行。
    // 注意用行首匹配——降采样声明行正文也会提到"📊 区间统计"字样。
    if (!isData && statLines.length > 0 && line.trimStart().startsWith('... 📊 区间统计')) return;

    if (!isData) {
      out.push(line);
      return;
    }
    if (!anchorEmitted) {
      anchorEmitted = true;
      out.push(
        `[紧凑模式] 完整 ${dataset.rows.length} 行已注入图表缓存` +
          `（data_key: "${dataKey}"，画图用 render_chart 引用即可）；` +
          `以下仅保留首尾锚点行与逐列统计，中间行不再罗列，` +
          `如需逐日明细请缩小日期范围重新查询。`
      );
      out.push(lines[firstIdx]); // 首行锚点
      out.push(lines[lastIdx]); // 末行锚点
      if (statLines.length > 0) {
        out.push(
          `📈 逐列统计（系统计算，逐字引用即可，数量级禁止改写）：`
        );
        out.push(...statLines);
      }
      // 事实卡（2026-09-22）：派生指标服务端算好注入，模型只引用不眼算
      if (factLines.length > 0) {
        out.push(FACT_CARD_HEADER);
        out.push(...factLines);
      }
    }
    // 中间与末尾数据行全部丢弃
  });

  return out.join('\n');
}
