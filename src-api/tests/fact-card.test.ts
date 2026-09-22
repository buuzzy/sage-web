/**
 * 事实卡回归测试（2026-09-22）
 *
 * 运行：npx tsx tests/fact-card.test.ts
 * 已知小序列逐位校验派生指标：累计倍数、年化、最大回撤（峰谷日期）、
 * 多代码分组、多格式日期解析。
 */
import assert from 'node:assert/strict';
import { buildFactCard, parseDateVal } from '../src/extensions/agent/codeany/fact-card.js';
import type { ParsedDataset } from '../src/extensions/agent/codeany/data-cache.js';

let passed = 0;
function check(name: string, cond: boolean, detail = '') {
  assert.ok(cond, `${name} ${detail}`);
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('── 日期解析 ──');
check('2026-09-21', parseDateVal('2026-09-21') === Date.UTC(2026, 8, 21));
check('20260921', parseDateVal('20260921') === Date.UTC(2026, 8, 21));
check('2021-02', parseDateVal('2021-02') === Date.UTC(2021, 1, 1));
check('2026/09/21', parseDateVal('2026/09/21') === Date.UTC(2026, 8, 21));
check('非法日期 null', parseDateVal('腾讯控股') === null);

console.log('── 派生指标（已知序列逐位校验）──');
// 两年序列：100 → 200 → 50 → 80
// 累计 -20%；最大回撤 (200-50)/200 = -75%（高点 200@2023-07-02，低点 50@2024-07-02）
function makeDataset(dates: string[], closes: number[]): ParsedDataset {
  return {
    columns: ['日期', '代码', '收盘'],
    rows: dates.map((d, i) => ({ 日期: d, 代码: '00700.HK', 收盘: String(closes[i]) })),
    source: 'hk_monthly',
  };
}
const ds = makeDataset(
  ['2023-01-01', '2023-07-02', '2024-07-02', '2025-01-01'],
  [100, 200, 50, 80]
);
const card = buildFactCard(ds);
check('事实卡输出 1 行', card.length === 1, JSON.stringify(card));
check('累计 -20.0%', card[0].includes('累计 -20%') || card[0].includes('累计 -20.0%'), card[0]);
check('年化约 -10.6%', card[0].includes('年化约 -10.6%'), card[0]);
check('最大回撤 -75%', card[0].includes('最大回撤 -75%'), card[0]);
check('高点日期 2023-07-02', card[0].includes('2023-07-02'), card[0]);
check('低点日期 2024-07-02', card[0].includes('低点 50@2024-07-02'), card[0]);
check('高点价格 200', card[0].includes('高点 200@'), card[0]);

console.log('── 大倍数口径（>=10 倍显示倍数）──');
const ds2 = makeDataset(['2006-01-03', '2026-01-03'], [1.4081, 430]);
const card2 = buildFactCard(ds2);
check('累计 305.376 倍', card2[0].includes('累计 305.376 倍'), card2[0]);
// 20 年年化：430/1.4081 = 305.4 ^(1/19.99) - 1 ≈ 33.4%
check('年化约 33.1%', card2[0].includes('年化约 33.1%'), card2[0]);

console.log('── 多代码分组 ──');
const multi: ParsedDataset = {
  columns: ['日期', '代码', '收盘'],
  rows: [
    { 日期: '20240101', 代码: '00700.HK', 收盘: '300' },
    { 日期: '20260101', 代码: '00700.HK', 收盘: '600' },
    { 日期: '20240101', 代码: '00005.HK', 收盘: '90' },
    { 日期: '20260101', 代码: '00005.HK', 收盘: '45' },
  ],
  source: 'hk_daily',
};
const card3 = buildFactCard(multi);
check('两组各 1 行', card3.length === 2, JSON.stringify(card3));
check('00700 翻倍', card3.find((l) => l.startsWith('· 00700.HK'))!.includes('累计 100%'), card3.join(' | '));
check('00005 腰斩', card3.find((l) => l.startsWith('· 00005.HK'))!.includes('累计 -50%'), card3.join(' | '));
check('yyyymmdd 日期解析生效', card3[0].includes('2024-01-01'), card3[0]);

console.log('── 无收盘列/空数据不产出 ──');
check('无收盘列返回空', buildFactCard({ columns: ['日期', '值'], rows: [{ 日期: '2024-01-01', 值: 'x' }], source: 'x' }).length === 0);
check('单一行不产出回撤但仍产出累计', buildFactCard(makeDataset(['2024-01-01'], [10])).length === 1);

console.log(`\n全部通过：${passed} 项`);
