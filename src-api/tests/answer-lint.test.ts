/**
 * 答案侧数字审计回归测试（2026-09-22）
 *
 * 运行：npx tsx tests/answer-lint.test.ts
 * 核心场景来自 Q5 实测失效：458 亿 vs 4583 亿量级错、阶段价格退回记忆
 * 价（冲到 470）、四舍五入放过（12.4 vs 12.42）、日期/年份/百分数/倍数/
 * 用户原值排除。
 */
import assert from 'node:assert/strict';
import { auditAnswer } from '../src/extensions/agent/codeany/answer-lint.js';
import type { ParsedDataset } from '../src/extensions/agent/codeany/data-cache.js';

let passed = 0;
function check(name: string, cond: boolean, detail = '') {
  assert.ok(cond, `${name} ${detail}`);
  passed++;
  console.log(`  ✓ ${name}`);
}

// 模拟腾讯 20 年月线缓存数据（含成交额原始值与复权收盘价）
const DS: ParsedDataset = {
  columns: ['日期', '代码', '收盘', '成交额'],
  rows: [
    { 日期: '2006-01-31', 代码: '00700.HK', 收盘: '1.4081', 成交额: '1200000000' },
    { 日期: '2014-05-30', 代码: '00700.HK', 收盘: '12.42', 成交额: '8000000000' },
    { 日期: '2018-01-31', 代码: '00700.HK', 收盘: '417.5', 成交额: '20000000000' },
    { 日期: '2021-02-26', 代码: '00700.HK', 收盘: '684.55', 成交额: '300000000000' },
    { 日期: '2025-02-28', 代码: '00700.HK', 收盘: '415.8', 成交额: '458300000000' },
    { 日期: '2026-09-21', 代码: '00700.HK', 收盘: '430', 成交额: '15000000000' },
  ],
  source: 'hk_monthly',
};

console.log('── Q5 失效场景：应拦下 ──');
check(
  '458 亿 vs 4583 亿量级错',
  auditAnswer('2025-02 成交额达 458 亿港元峰值。', undefined, [DS]).length === 1
);
check(
  '记忆价 470 vs 真值 417.5',
  auditAnswer('2018 年初股价冲到 470。', undefined, [DS]).length === 1
);
check(
  '虚构高点价格',
  auditAnswer('盘中触及 655 港元。', undefined, [DS]).length === 1
);

console.log('── 正确引用：应放过 ──');
check(
  '四舍五入 12.4 ≈ 12.42',
  auditAnswer('拆股当年收于 12.4 港元。', undefined, [DS]).length === 0
);
check(
  '量级换算 4583 亿匹配原始值',
  auditAnswer('2025-02 成交额峰值 4583 亿。', undefined, [DS]).length === 0
);
check(
  '价格 430 港元在宇宙中',
  auditAnswer('最新收盘 430 港元。', undefined, [DS]).length === 0
);
check(
  '高点 684.55 匹配',
  auditAnswer('区间高点 684.55。', undefined, [DS]).length === 0
);

console.log('── 排除规则：不误伤 ──');
check(
  '年份排除（高点 2021）',
  auditAnswer('股价高点出现在 2021 年。', undefined, [DS]).length === 0
);
check(
  '百分数跳过',
  auditAnswer('当月上涨 22.8%，累计 305 倍。', undefined, [DS]).length === 0
);
check(
  '用户问题原值复述放过',
  auditAnswer('好的，来看 419 港元附近的走势。', '419 港元附近的走势怎么样？', [DS]).length === 0
);
check(
  '回显排除按数字边界：问题含代码 00700 不豁免回答中的 70 港元',
  auditAnswer('股价冲上 70 港元。', '腾讯控股 00700 的走势？', [DS]).length === 1
);
check(
  '普通计数不受价格动词误伤（"报告"含报字但数字无动词语义场景放过）',
  auditAnswer('报告期共有 3 条记录。', undefined, [DS]).length === 0
);

console.log('── 边界 ──');
check('空数据集返回空', auditAnswer('最高 683 港元', undefined, []).length === 0);
check('空文本返回空', auditAnswer('', undefined, [DS]).length === 0);
check(
  '多失配全部报告',
  auditAnswer('2018 初冲到 470，2025-02 成交额 458 亿。', undefined, [DS]).length === 2
);

console.log(`\n全部通过：${passed} 项`);
