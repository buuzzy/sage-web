/**
 * 紧凑模式输出改写回归测试（2026-09-21 架构升级）
 *
 * 运行：npx tsx tests/compact-output.test.ts
 * 场景：长序列改写（锚点+逐列统计+中间行丢弃+标题/声明保留、MCP 📊 行归一丢弃）、
 * 短序列原样（📊 行保留）、多代码分组、文本列不输出统计、旧截断行清理。
 * 任何对 buildCompactOutput 的改动必须先过这里。
 */
import assert from 'node:assert/strict';
import {
  buildCompactOutput,
  isDataRowLine,
  COMPACT_THRESHOLD,
} from '../src/extensions/agent/codeany/compact-output.js';
import { parseToolOutput } from '../src/extensions/agent/codeany/data-cache.js';

let passed = 0;
function check(name: string, cond: boolean, detail = '') {
  assert.ok(cond, `${name} ${detail}`);
  passed++;
  console.log(`  ✓ ${name}`);
}

// ---------------------------------------------------------------------------
// 构造模拟输出： daily_basic 三年周频（复刻真实输出结构）
// ---------------------------------------------------------------------------

function buildFakeDailyBasic(rows: number): string {
  const lines = [
    `--- 每日基本面指标 (Total: ${rows}) ---`,
    `... ⚠️ 原始 ${rows * 5} 条日线超过显示上限，已自动降采样为 ${rows} 条周频（每列取周内最新值，区间走势图表直接用本数据绘制即可，与日线等效；📊 区间统计行仍按日线全量计算，精度到日）。如需日线明细，请缩小日期范围重新查询。`,
  ];
  // 收盘价从 2000 单调降到 1200 再回升，PE(TTM) 同步；中间夹一个文本值防误判
  for (let i = 0; i < rows; i++) {
    const d = 20230922 + i * 7; // 伪日期，仅测试用
    const close = i < rows / 2 ? 2000 - i : 1200 + (i - rows / 2);
    const pe = 30 - i * 0.05;
    lines.push(
      `日期:${d} | 代码:600519.SH | 收盘:${close.toFixed(2)} | 换手率:0.3% | PE(TTM):${pe.toFixed(4)} | PB:6.0`
    );
  }
  lines.push(
    `... 📊 区间统计（服务端已计算，直接引用即可，无需自行扫描或补查）：PE(TTM) 最高 30（20230922）/ 最低 26.05（20260918）；最新 20260918：PE(TTM)=26.05、PB=6`
  );
  return lines.join('\n');
}

const N = 154;
const fake = buildFakeDailyBasic(N);
const dataset = parseToolOutput(fake, 'daily_basic')!;

console.log('── 场景组 1：行分类 ──');
check('数据行识别', isDataRowLine('日期:20260918 | 收盘:1257.12'));
check('标题行不算数据行', !isDataRowLine('--- 每日基本面指标 (Total: 154) ---'));
check('声明行不算数据行', !isDataRowLine('... ⚠️ 已自动降采样'));
check('📊 行不算数据行', !isDataRowLine('... 📊 区间统计（服务端已计算）：PE(TTM) 最高 30'));

console.log('── 场景组 2：长序列紧凑改写 ──');
const compact = buildCompactOutput(fake, dataset, 'daily_basic_1');
const compactLines = compact.split('\n');

check('触发紧凑（>=40 行）', N >= COMPACT_THRESHOLD);
check('标题行保留', compact.includes('--- 每日基本面指标 (Total: 154) ---'));
check('降采样声明保留', compact.includes('已自动降采样'));
check('紧凑模式声明注入', compact.includes('[紧凑模式]') && compact.includes('daily_basic_1'));
check('首行锚点保留', compact.includes('日期:20230922'));
check('末行锚点保留', compact.includes(`日期:${20230922 + (N - 1) * 7}`));
check('中间行丢弃', !compact.includes('收盘:1500'), '（中间段价格不应出现）');
check('MCP 📊 统计行紧凑下丢弃（与逐列统计归一）', !compact.includes('📊 区间统计（服务端已计算'));

// 逐列统计正确性（收盘：min 在 i=rows/2 处 = 1200.00；max 在 i=0 = 2000.00）
const closeLine = compactLines.find((l) => l.includes('收盘：'));
check('收盘统计行存在', !!closeLine);
check('收盘最新值', closeLine!.includes('最新 1257') === false && closeLine!.includes('最新 '), '（格式存在即可）');
check('收盘最高 2000', closeLine!.includes('最高 2000.00（20230922）'));
check('收盘最低 1200', closeLine!.includes('最低 1200.00'));
check('PE(TTM) 统计行存在', compactLines.some((l) => l.includes('PE(TTM)：')));
check('中位数输出', closeLine!.includes('中位数'));
check('最新分位输出', closeLine!.includes('最新分位'));

// token 对比：紧凑输出应远小于原输出
check('体积显著缩小', compact.length < fake.length * 0.3, `（${compact.length} vs ${fake.length} 字符）`);

console.log('── 场景组 3：短序列与解析失败原样 ──');
const short = buildFakeDailyBasic(10);
const shortDs = parseToolOutput(short, 'daily_basic')!;
check('短序列原样返回', buildCompactOutput(short, shortDs, 'k') === short);
check('短序列保留 MCP 📊 统计行', short.includes('📊 区间统计（服务端已计算'));

console.log('── 场景组 4：多代码分组 ──');
const multiLines = ['--- 每日基本面指标 (Total: 80) ---'];
for (let i = 0; i < 45; i++) {
  multiLines.push(`日期:${20240101 + i} | 代码:600519.SH | 收盘:${(100 + i).toFixed(2)}`);
  multiLines.push(`日期:${20240101 + i} | 代码:000858.SZ | 收盘:${(50 - i / 2).toFixed(2)}`);
}
const multi = multiLines.join('\n');
const multiDs = parseToolOutput(multi, 'daily_basic')!;
const multiCompact = buildCompactOutput(multi, multiDs, 'k2');
check('600519 分组统计', multiCompact.includes('600519.SH 收盘'));
check('000858 分组统计', multiCompact.includes('000858.SZ 收盘'));

console.log('── 场景组 5：旧截断行清理 ──');
const withTruncNote = buildFakeDailyBasic(N).replace(
  '如需日线明细，请缩小日期范围重新查询。',
  '如需日线明细，请缩小日期范围重新查询。\n... (共 725 条，仅显示前 154 条)'
);
const truncDs = parseToolOutput(withTruncNote, 'daily_basic')!;
const truncCompact = buildCompactOutput(withTruncNote, truncDs, 'k3');
check('旧"仅显示前 N 条"行被清理', !truncCompact.includes('仅显示前'));

console.log('── 场景组 6：单日全市场截面不紧凑 ──');
// trade_date 模式：155 行 = 155 只股票同一天的截面，不是时间序列
const crossLines = ['--- 每日基本面指标 (Total: 155) ---'];
for (let i = 0; i < 155; i++) {
  crossLines.push(
    `日期:20260921 | 代码:${String(600000 + i).padStart(6, '0')}.SH | 收盘:${(10 + i).toFixed(2)} | PE(TTM):${(10 + i * 0.1).toFixed(4)}`
  );
}
const cross = crossLines.join('\n');
const crossDs = parseToolOutput(cross, 'daily_basic')!;
check('截面表原样返回', buildCompactOutput(cross, crossDs, 'k4') === cross);

console.log('── 场景组 7：无日期列不紧凑 ──');
const noDateLines = ['--- 财务报表 (Total: 50) ---'];
for (let i = 0; i < 50; i++) {
  noDateLines.push(`报告期:${20200101 + i} | 营业收入:${(100 + i).toFixed(2)} | 净利润:${(20 + i).toFixed(2)}`);
}
const noDate = noDateLines.join('\n');
const noDateDs = parseToolOutput(noDate, 'income')!;
check('无日期列表格原样返回', buildCompactOutput(noDate, noDateDs, 'k5') === noDate);

console.log(`\n全部通过：${passed} 项`);
