/**
 * 答案侧数字审计（Answer Lint）——2026-09-22。
 *
 * 背景：Q5 复测证明"服务端给了正确的数据，模型也不一定用"——统计行里
 * 明明有 4583 亿，回答写成 458 亿；叙事里的阶段价格退回训练记忆的未复权
 * 牌价。输入端结构化（紧凑模式+事实卡）解决不了"模型转述失真"，需要
 * 在输出端加一道硬校验：把最终文本中的价格/大数与本轮数据集做容差比对。
 *
 * 与报价门禁互为镜像：门禁管"没调工具就报数"，本模块管"报出来的数
 * 对不对"。
 *
 * v1 为 warn 模式：只记日志不下发前端/不重答——先观察误报率，确认
 * 容差与排除规则可控后再启用拦截重答（届时需缓冲最终文本块）。
 *
 * 检查范围（刻意收窄，防误伤）：
 *  1. 带 亿/万/万亿 后缀的数（458 亿 vs 4583 亿 量级错）
 *  2. 带币种的数（683 港元 / 236 USD）
 *  3. 价格动词（冲到/触及/高点…）邻近的裸数（"2018 初冲到 470"）
 * 排除：日期/年份形态、百分数（多为派生值）、"倍"后缀（派生值）、
 * 用户问题中已有的原值（纯复述）。
 *
 * 本模块刻意保持零依赖纯函数，便于回归测试。
 */

import type { ParsedDataset } from './data-cache';
import { parseNum } from './data-cache';
import { buildFactCard } from './fact-card';

export interface LintMismatch {
  /** 原文中的数字片段（含后缀/币种）。 */
  raw: string;
  /** 换算后的数值（亿/万已展开）。 */
  scaled: number;
  /** 真值宇宙中最接近的值；空宇宙为 null。 */
  nearest: number | null;
  /** 与最近值的相对偏差；空宇宙为 null。 */
  deviation: number | null;
  /** 命中处的上下文片段。 */
  snippet: string;
}

/** 后缀换算系数。 */
const SUFFIX_SCALE: Record<string, number> = {
  万: 1e4,
  亿: 1e8,
  万亿: 1e12,
};

/** 价格动词：裸数仅在这些词邻近时才检查（"2018 初冲到 470"）。刻意不收
 * 单字"报/见"——"报告期/可见"会误伤普通计数。 */
const PRICE_VERB_RE =
  /(高点|低点|触及|冲[到上]?|跌[到至]|涨[到至]|下探|站上|收于|收报|报于)/;

const CURRENCY_RE = /港元|港币|美元|美金|人民币|HKD|USD|CNY|RMB|元/;

/** 容差：相对偏差 1.5%（覆盖四舍五入与常规缩写）。 */
const TOLERANCE = 0.015;

interface Candidate {
  raw: string;
  num: number;
  suffix: string;
  currency: string;
  index: number;
}

/** 提取候选数字及其后缀/币种。 */
function extractCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(万亿|亿|万)?\s*(港元|港币|美元|美金|人民币|HKD|USD|CNY|RMB)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const num = parseFloat(m[1].replace(/,/g, ''));
    if (isNaN(num)) continue;
    out.push({
      raw: m[0].trim(),
      num,
      suffix: m[2] ?? '',
      currency: m[3] ?? '',
      index: m.index,
    });
  }
  return out;
}

/** 日期/年份形态排除：2021、2026-09、20260921、2021年 等。 */
function isDateLike(text: string, index: number, num: number): boolean {
  const digits = text.slice(index).match(/^[\d,]+/)![0].replace(/,/g, '');
  // 后接 年/月/日 或 -/月 日期分隔
  const after = text.slice(index + digits.length, index + digits.length + 2);
  if (/^[年月日]|^[-/]\d{1,2}/.test(after) && digits.length >= 4) return true;
  // 纯 4 位且落在年份区间、无小数
  if (digits.length === 4 && num >= 1900 && num <= 2100) {
    // 除非后面紧跟币种（"2021 港元"不太可能，但防御）——仍视为年份
    return true;
  }
  // 8 位 yyyymmdd
  if (digits.length === 8 && /^(19|20)\d{6}$/.test(digits)) return true;
  // 6 位 yyyymm
  if (digits.length === 6 && /^(19|20)\d{4}$/.test(digits)) return true;
  return false;
}

/** 真值条目：derived = 事实卡派生值（倍数/年化/回撤%），非市场原始价格。 */
export interface TruthValue {
  value: number;
  derived: boolean;
}

/** 从数据集宇宙（全部单元格 + 事实卡派生值）收集真值数字。 */
export function buildTruthUniverse(datasets: ParsedDataset[]): TruthValue[] {
  const out: TruthValue[] = [];
  for (const ds of datasets) {
    for (const row of ds.rows) {
      for (const col of ds.columns) {
        const v = parseNum(row[col]);
        if (v !== null && isFinite(v)) out.push({ value: v, derived: false });
      }
    }
    // 事实卡派生值（倍数/年化/回撤/峰谷价）也进宇宙。
    // 标记 derived：回撤 70.96% 这类比率不该掩护"70 港元"这类价格失真
    // （2026-09-22 样本回归实测：70 vs 70.96 偏差 1.35% 恰好钻进容差）。
    for (const line of buildFactCard(ds)) {
      const re = /-?[\d,]+\.?\d*/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        const v = parseFloat(m[0].replace(/,/g, ''));
        if (!isNaN(v)) out.push({ value: v, derived: true });
      }
    }
  }
  return out;
}

function nearestOf(
  universe: TruthValue[],
  x: number,
  priceKind: boolean
): { nearest: number | null; deviation: number | null } {
  let nearest: number | null = null;
  let dev: number | null = null;
  const scan = (items: TruthValue[]) => {
    for (const u of items) {
      if (u.value === 0) continue;
      const d = Math.abs(x - u.value) / Math.abs(u.value);
      if (dev === null || d < dev) {
        dev = d;
        nearest = u.value;
      }
    }
  };
  // 币种/价格动词语境 = 市场价格语义：优先与原始行情值比对；只有当偏差
  // 大到（>50%）明显不在价格量级时，才退回派生值宇宙兜底（防止峰谷价
  // 只出现在派生卡里的情况漏报）。
  scan(universe.filter((u) => !u.derived));
  if (priceKind && (dev === null || dev > 0.5)) {
    scan(universe.filter((u) => u.derived));
  }
  return { nearest, deviation: dev };
}

/**
 * 审计回答文本：返回未能通过真值比对的可疑数字列表。空数组 = 通过。
 * userPrompt 用于排除纯复述（与报价门禁回显排除同口径）。
 */
export function auditAnswer(
  text: string,
  userPrompt: string | undefined,
  datasets: ParsedDataset[]
): LintMismatch[] {
  if (!text || datasets.length === 0) return [];
  const universe = buildTruthUniverse(datasets);
  if (universe.length === 0) return [];

  const candidates = extractCandidates(text);
  const mismatches: LintMismatch[] = [];

  for (const cand of candidates) {
    const isSuffixed = cand.suffix in SUFFIX_SCALE;
    const hasCurrency = cand.currency !== '' && CURRENCY_RE.test(cand.currency);
    if (!isSuffixed && !hasCurrency) {
      // 裸数：仅价格动词邻近时检查
      const before = text.slice(Math.max(0, cand.index - 8), cand.index);
      if (!PRICE_VERB_RE.test(before)) continue;
    }
    // 百分数跳过（多为派生值，v1 不校验）
    const after = text.slice(cand.index + cand.raw.length, cand.index + cand.raw.length + 2);
    if (after.startsWith('%') || after.startsWith('％')) continue;
    // 日期/年份形态跳过
    if (isDateLike(text, cand.index, cand.num)) continue;
    // 用户问题原值（纯复述）跳过。必须按数字边界匹配：问题里出现股票
    // 代码 00700 时，子串匹配会把回答中的 "70 港元" 误判为复述放行
    // （2026-09-22 重放回归实测踩坑）。
    const rawNum = cand.raw.replace(/[^\d.,]/g, '');
    if (userPrompt && rawNum && new RegExp(`(?<![\\d.,])${rawNum.replace(/\./g, '\\.')}(?![\\d.,])`).test(userPrompt)) continue;

    const scale = SUFFIX_SCALE[cand.suffix] ?? 1;
    const scaled = cand.num * scale;
    // 币种与价格动词邻近的裸数是市场价格语义；亿/万后缀（成交额/市值）
    // 量级跨度大，不限定价格语义。
    const priceKind = hasCurrency || !isSuffixed;
    const { nearest, deviation } = nearestOf(universe, scaled, priceKind);
    if (deviation === null || deviation > TOLERANCE) {
      mismatches.push({
        raw: cand.raw,
        scaled,
        nearest,
        deviation,
        snippet: text.slice(
          Math.max(0, cand.index - 20),
          cand.index + cand.raw.length + 20
        ),
      });
    }
  }
  return mismatches;
}
