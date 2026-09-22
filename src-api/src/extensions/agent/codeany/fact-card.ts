/**
 * 事实卡（Fact Card）——服务端派生指标（2026-09-22）。
 *
 * 背景：紧凑模式注入的逐列统计是"原始统计"（最高/最低/最新/分位），
 * 但模型叙事时真正要用的是派生事实——Q5 实测中"累计 305 倍"是模型
 * 眼算的除法（碰巧对），最大回撤、年化这类更复杂的派生全靠现场发挥，
 * 错了没有数据可对。本模块基于 data-cache 的结构化数据直接算好这组
 * 派生指标，以「逐字引用」块注入紧凑上下文，消灭"需要模型自己算"
 * 的场景——这是"输入结构化 → 输出更准"原则在分析层的补全。
 *
 * 本模块刻意保持零依赖纯函数（仅依赖 data-cache 类型），便于回归测试。
 */

import type { ParsedDataset } from './data-cache';
import { findCol, parseNum } from './data-cache';

/** 紧凑数值：12.3400 -> 12.34，419.0 -> 419（与 compact-output 口径一致）。 */
function fmtNum(n: number): string {
  if (!isFinite(n)) return String(n);
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  return n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

/** 百分数：0.2134 -> "21.3%"。 */
function fmtPct(x: number): string {
  return `${(x * 100).toFixed(1).replace(/\.0$/, '')}%`;
}

/**
 * 解析数据集中的日期值为 UTC 毫秒。兼容 "2026-09-21"、"20260921"、
 * "2021-02"、"2026/09/21"、"202609" 等常见口径。无法解析返回 null。
 */
export function parseDateVal(s: string | undefined): number | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{4})[-/年](\d{1,2})(?:[-/月](\d{1,2}))?/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1);
  m = t.match(/^(\d{4})(\d{2})(\d{2})$/); // 20260921
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = t.match(/^(\d{4})(\d{2})$/); // 202609
  if (m) return Date.UTC(+m[1], +m[2] - 1, 1);
  return null;
}

/** 毫秒 -> "YYYY-MM-DD" 显示口径。 */
function fmtDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

interface GroupStats {
  label: string;
  firstClose: number;
  lastClose: number;
  firstDate: number;
  lastDate: number;
  maxDrawdown: number; // 负值，如 -0.753
  ddPeak: number;
  ddPeakDate: number;
  ddTrough: number;
  ddTroughDate: number;
}

/** 对单个代码分组的收盘序列计算派生指标；不足 2 个有效收盘返回 null。 */
function computeGroupStats(
  label: string,
  rows: Record<string, string>[],
  dateCol: string,
  closeCol: string
): GroupStats | null {
  let firstClose: number | null = null;
  let firstDate = 0;
  let lastClose = 0;
  let lastDate = 0;
  let runMax = -Infinity;
  let runMaxDate = 0;
  let dd = 0;
  let ddPeak = 0;
  let ddPeakDate = 0;
  let ddTrough = 0;
  let ddTroughDate = 0;

  for (const row of rows) {
    const close = parseNum(row[closeCol]);
    if (close === null || close <= 0) continue;
    const date = parseDateVal(row[dateCol]);
    if (date === null) continue;
    if (firstClose === null) {
      firstClose = close;
      firstDate = date;
    }
    lastClose = close;
    lastDate = date;
    if (close > runMax) {
      runMax = close;
      runMaxDate = date;
    }
    const curDd = (close - runMax) / runMax;
    if (curDd < dd) {
      dd = curDd;
      ddPeak = runMax;
      ddPeakDate = runMaxDate;
      ddTrough = close;
      ddTroughDate = date;
    }
  }

  if (firstClose === null || firstClose <= 0) return null;
  return {
    label,
    firstClose,
    lastClose,
    firstDate,
    lastDate,
    maxDrawdown: dd,
    ddPeak,
    ddPeakDate,
    ddTrough,
    ddTroughDate,
  };
}

/**
 * 从数据集生成事实卡行（不含标题）。无收盘列 / 有效分组为空时返回空数组。
 * 刻意不与逐列统计重复：最高/最低/最新/分位已由统计块给出，这里只给
 * 派生值——累计倍数、年化、最大回撤（含峰谷日期）。
 */
export function buildFactCard(dataset: ParsedDataset): string[] {
  const dateCol = dataset.columns.find(
    (c) => c.includes('日期') || c.toLowerCase() === 'date'
  );
  const closeCol = findCol(dataset, ['收盘', '收盘价', 'close']);
  if (!dateCol || !closeCol) return [];

  const codeCol = dataset.columns.find(
    (c) =>
      c === '代码' || ['ts_code', 'code', 'symbol'].includes(c.toLowerCase())
  );

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

  const lines: string[] = [];
  for (const [code, rows] of groups) {
    const st = computeGroupStats(code, rows, dateCol, closeCol);
    if (!st) continue;
    const multiple = st.lastClose / st.firstClose;
    const label = st.label ? `${st.label} ` : '';
    const parts: string[] = [
      `区间 ${fmtDate(st.firstDate)}~${fmtDate(st.lastDate)}`,
    ];
    if (multiple >= 10) {
      parts.push(`累计 ${fmtNum(multiple)} 倍（${fmtNum(st.firstClose)}→${fmtNum(st.lastClose)}）`);
    } else {
      parts.push(`累计 ${fmtPct(multiple - 1)}（${fmtNum(st.firstClose)}→${fmtNum(st.lastClose)}）`);
    }
    const years = (st.lastDate - st.firstDate) / (365.25 * 86400000);
    if (years >= 1 && multiple > 0) {
      const annualized = Math.pow(multiple, 1 / years) - 1;
      parts.push(`年化约 ${fmtPct(annualized)}`);
    }
    if (st.maxDrawdown < -0.001) {
      parts.push(
        `最大回撤 ${fmtPct(st.maxDrawdown)}（高点 ${fmtNum(st.ddPeak)}@${fmtDate(st.ddPeakDate)} → 低点 ${fmtNum(st.ddTrough)}@${fmtDate(st.ddTroughDate)}）`
      );
    }
    lines.push(`· ${label}${parts.join('｜')}`);
  }
  return lines;
}

/** 事实卡标题行（含引用纪律）。 */
export const FACT_CARD_HEADER = '📊 事实卡（服务端派生，逐字引用，禁止改写数量级）：';
