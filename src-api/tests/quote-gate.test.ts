/**
 * 报价硬门禁回归测试
 *
 * 运行：npx tsx tests/quote-gate.test.ts
 * 覆盖 2026-09-15（凭记忆编造）与 2026-09-20（开场白复述误拦 + 锁存重查）
 * 两次事故的全部场景，任何对 matchesQuoteGate 的改动必须先过这里。
 */
import assert from 'node:assert/strict';
import { matchesQuoteGate } from '../src/extensions/agent/codeany/quote-gate.js';

let passed = 0;

function check(name: string, actual: boolean, expected: boolean) {
  assert.equal(actual, expected, `${name}: 期望 ${expected}，实际 ${actual}`);
  passed++;
  console.log(`  ✓ ${name}`);
}

const TENCENT_Q = '查询腾讯控股（00700.HK）近 3 年的港股日 K 线，告诉我区间最高价和区间最低价。';
const MOUTAI_Q = '贵州茅台（600519）近一年最高价多少？';
const PINGAN_Q = '中国平安（601318）和比亚迪（002594）现在的股价。';

console.log('── 场景组 1：纯复述（应放行，2026-09-20 事故核心场景）──');
check(
  '开场白复述港股代码',
  matchesQuoteGate('好的，我来查询腾讯控股（00700.HK）近 3 年的行情。', TENCENT_Q),
  false
);
check(
  '复述深市主板代码',
  matchesQuoteGate('正在查询比亚迪（002594）的数据。', PINGAN_Q),
  false
);
check(
  '复述沪市代码',
  matchesQuoteGate('贵州茅台 600519 的年线数据获取中。', MOUTAI_Q),
  false
);
check(
  '复述多个代码',
  matchesQuoteGate('查询 601318 与 002594 两只标的。', PINGAN_Q),
  false
);

console.log('── 场景组 2：凭记忆编造（应拦截，2026-09-15 事故核心场景）──');
check(
  '编造带币种价格',
  matchesQuoteGate('腾讯近 3 年最高 683 港元、最低 260.2 港元。', TENCENT_Q),
  true
);
check(
  '编造美元价格',
  matchesQuoteGate('NVDA 目前约 236 USD。'),
  true
);
check(
  '编造问题中没有的新代码',
  matchesQuoteGate('您可能想查询的是 00700.HK，另外我也看了下 00388。', TENCENT_Q),
  true
);
check(
  '无用户上下文时任何命中都拦截',
  matchesQuoteGate('最高价 683 港元'),
  true
);

console.log('── 场景组 3：混合（复述 + 新值，应拦截）──');
check(
  '复述代码 + 编造价格',
  matchesQuoteGate('查询 00700：最高 683 港元。', TENCENT_Q),
  true
);
check(
  '复述价格 + 编造新价格',
  matchesQuoteGate('683 港元是历史高点，当前 419 港元。', TENCENT_Q),
  true
);

console.log('── 场景组 4：不误伤（窄匹配回归）──');
check(
  '指数点位/百分比不触发',
  matchesQuoteGate('沪深300指数上涨2.5%，成交额破万亿。', '大盘今天怎么样？'),
  false
);
check(
  '纯数字金额（无币种）不触发',
  matchesQuoteGate('营收增长到 5200 亿。'),
  false
);
check(
  '六位非代码数字不触发',
  matchesQuoteGate('订单号 123456 已创建。'),
  false
);

console.log(`\n全部 ${passed} 个断言通过 ✅`);
