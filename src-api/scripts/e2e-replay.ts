/**
 * Q1-Q6 端到端重放脚本（2026-09-22）——回答产出工程化的回归 oracle。
 *
 * 背景：Q1-Q6 六道金融题的验收一直靠人眼看回答。verify 只覆盖 MCP 数据层，
 * 没有任何手段自动校验"模型最终写的数字对不对"。answer-lint 审计引擎建成后，
 * 它就是天然的 oracle：重放问题 → 收集最终文本 → 数字对真值容差比对。
 *
 * 两种模式：
 *   默认（sample）  内置 Q5 已知错误答案回归：审计引擎必须抓出 458 亿/70/470
 *                   三处失真，且放过 655（容差内四舍五入）——不通过即退出码 1。
 *   --live          对生产 API 逐题重放六道题（需 REPLAY_TOKEN），SSE 收集
 *                   最终文本存 replay/ 目录，有真值 fixture 的题自动审计。
 *
 * 用法：
 *   npx tsx scripts/e2e-replay.ts                     # 离线回归（CI 可用）
 *   REPLAY_TOKEN=xxx npx tsx scripts/e2e-replay.ts --live [--url https://sage.nakocai.com]
 */

import { auditAnswer } from '../src/extensions/agent/codeany/answer-lint.js';
import type { ParsedDataset } from '../src/extensions/agent/codeany/data-cache.js';
import { parseNum } from '../src/extensions/agent/codeany/data-cache.js';

// ---------------------------------------------------------------------------
// 真值 fixture：来自 MCP 线上 verify 基线（2026-09-21 已逐位核验）
// ---------------------------------------------------------------------------

/** Q5 腾讯 20 年月线 qfq 已核验真值。 */
const TENCENT_20Y_TRUTH: ParsedDataset = {
  toolName: 'hk_monthly',
  title: '腾讯控股 00700 月线 qfq 20 年（真值基线）',
  columns: ['date', 'close', 'turnover'],
  rows: [
    { date: '2006-01', close: '1.4081', turnover: String(1e8) },
    { date: '2007-10', close: '12.4', turnover: String(1e8) },
    { date: '2014-05', close: '75', turnover: String(1e8) },
    { date: '2018-01', close: '417.5', turnover: String(1e8) },
    { date: '2021-02-18', close: '684.5508', turnover: String(1e8) },
    { date: '2021-02-18盘中', close: '658.8', turnover: String(1e8) },
    { date: '2022-10', close: '198.6', turnover: String(1e8) },
    { date: '2025-02', close: '430', turnover: '458300000000' },
    { date: '2026-09', close: '430', turnover: String(1e8) },
    { date: '2024-05', close: '370', turnover: String(1e8) },
    { date: '2021-06', close: '620', turnover: String(1e8) },
  ],
};

/** 六道测试题（与 2026-09 测试季一致；live 重放用）。 */
const SIX_QUESTIONS = [
  'Q1: 贵州茅台 600519 最近一年的周线走势如何？',
  'Q2: 苹果 AAPL 近三年最高价和最低价是多少？',
  'Q3: 沪深300 指数 2025 年表现如何？',
  'Q4: 宁德时代 300750 近一年日线走势与成交额？',
  'Q5: 腾讯控股 00700 过去 20 年的月线前复权走势？',
  'Q6: 比亚迪 002594 与长城汽车 601633 近一年走势对比？',
];

/** live 重放时已核验真值的题目索引（其余题跑通后按 MCP verify 基线补充）。 */
const LIVE_TRUTH: Record<number, ParsedDataset[]> = {
  4: [TENCENT_20Y_TRUTH], // Q5（0-based）
};

// ---------------------------------------------------------------------------
// 内置回归样本：Q5 复测中已逐条人工核验的错误/正确表述
// ---------------------------------------------------------------------------

/** 已知坏答案：含 3 处已核验失真 + 1 处容差内舍入。 */
const Q5_KNOWN_BAD = [
  '腾讯过去20年累计上涨约305倍。',
  '2007年10月股价冲上70港元，2018年1月触及470港元。',
  '2025年2月成交额达到458亿港元，创历史新高。',
  '2021年2月盘中触及655港元后回落。',
  '2010年推出微信，2011年1月正式发布。',
].join('\n');

/** 已知好答案：所有数字均在真值宇宙内。 */
const Q5_KNOWN_GOOD = [
  '腾讯控股过去20年前复权累计上涨约305倍。',
  '区间最高684.55港元（2021-02-18），最低1.4081港元（2006-01-03），最新430港元。',
  '2025年2月成交额达到4583亿港元，创历史峰值。',
  '2021年2月盘中触及655港元后回落。',
].join('\n');

// ---------------------------------------------------------------------------
// 样本模式：审计引擎必须命中指定失真、放过容差内数字
// ---------------------------------------------------------------------------

function datasetOf(values: string[], col = 'close'): ParsedDataset {
  return {
    toolName: 'fixture',
    title: 'fixture',
    columns: ['date', col],
    rows: values.map((v, i) => ({ date: `r${i}`, [col]: v })),
  };
}

function runSampleMode(): number {
  let fail = 0;
  const check = (name: string, ok: boolean, detail?: string) => {
    console.log(`  ${ok ? '✓' : '✗'} ${name}${!ok && detail ? ` —— ${detail}` : ''}`);
    if (!ok) fail++;
  };

  console.log('── 样本回归：Q5 已知坏答案 ──');
  const truth = [TENCENT_20Y_TRUTH, datasetOf(['305', '486'])];
  const bad = auditAnswer(Q5_KNOWN_BAD, '腾讯控股 00700 过去 20 年的月线前复权走势？', truth);
  const badRaw = bad.map((m) => m.raw);
  // raw 可能含币种/后缀（如 "458亿港元"），断言一律用子串匹配
  const flagged = (frag: string) => badRaw.some((r) => r.includes(frag));
  check('抓出 458 亿（数量级失真）', flagged('458亿'), JSON.stringify(badRaw));
  check('抓出 70（叙事退回未复权记忆价）', flagged('70港元'), JSON.stringify(badRaw));
  check('抓出 470（叙事退回未复权记忆价）', flagged('470港元'), JSON.stringify(badRaw));
  check('放过 655（容差内舍入，真值 658.8）', !flagged('655港元'), JSON.stringify(badRaw));
  check('年份/派生值零误伤（2010/305/倍数均不报）', bad.length === 3, JSON.stringify(bad.map((m) => m.raw)));

  console.log('── 样本回归：Q5 已知好答案 ──');
  const good = auditAnswer(Q5_KNOWN_GOOD, '腾讯控股 00700 过去 20 年的月线前复权走势？', truth);
  check('好答案零误伤', good.length === 0, JSON.stringify(good.map((m) => m.raw)));

  console.log('── 样本回归：用户原值复述排除 ──');
  const echo = auditAnswer(
    '您问的 999 元大约对应多少倍，以下按 999 元估算……',
    '999 元大约对应多少倍',
    [datasetOf(['500', '250'])],
  );
  check('问题原值不报', echo.length === 0, JSON.stringify(echo.map((m) => m.raw)));

  console.log(fail === 0 ? '\n样本回归全部通过 ✅' : `\n${fail} 项失败 ❌`);
  return fail === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// live 模式：逐题重放生产 API，SSE 收集最终文本并审计
// ---------------------------------------------------------------------------

interface LiveOptions {
  baseUrl: string;
  token?: string;
  userId: string;
}

async function replayOne(q: string, opts: LiveOptions): Promise<string> {
  const resp = await fetch(`${opts.baseUrl}/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: q,
      userId: opts.userId,
      accessToken: opts.token,
      language: 'zh',
    }),
  });
  if (!resp.ok || !resp.body) {
    throw new Error(`HTTP ${resp.status}`);
  }
  // SSE：收集全部 text 块为最终回答
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let answer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const m = frame.match(/^data: (.*)$/s);
      if (!m) continue;
      try {
        const evt = JSON.parse(m[1]);
        if (evt.type === 'text' && evt.content) answer += evt.content;
        if (evt.type === 'error') answer += `\n[error] ${evt.content ?? ''}`;
      } catch {
        /* 非 JSON 帧（心跳等）忽略 */
      }
    }
  }
  return answer.trim();
}

async function runLiveMode(opts: LiveOptions): Promise<number> {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const outDir = new URL('../replay/', import.meta.url).pathname;
  mkdirSync(outDir, { recursive: true });

  let fail = 0;
  for (let i = 0; i < SIX_QUESTIONS.length; i++) {
    const q = SIX_QUESTIONS[i];
    console.log(`\n[${i + 1}/${SIX_QUESTIONS.length}] ${q}`);
    let answer = '';
    try {
      answer = await replayOne(q, opts);
    } catch (err) {
      console.log(`  ✗ 重放失败：${err}`);
      fail++;
      continue;
    }
    const file = `${outDir}q${i + 1}.txt`;
    writeFileSync(file, answer, 'utf8');
    console.log(`  回答 ${answer.length} 字 → ${file}`);

    const truth = LIVE_TRUTH[i];
    if (!truth) {
      console.log('  （该题暂无真值 fixture，仅存档；跑通后按 MCP verify 基线补入 LIVE_TRUTH）');
      continue;
    }
    const mismatches = auditAnswer(answer, q, truth);
    if (mismatches.length === 0) {
      console.log('  ✓ 审计通过：回答中数字全部落在真值宇宙内');
    } else {
      console.log(`  ✗ 审计发现 ${mismatches.length} 处可疑数字：`);
      for (const m of mismatches) {
        const dev = m.deviation === null ? '∅' : `${(m.deviation * 100).toFixed(1)}%`;
        console.log(`    - ${m.raw}（换算 ${m.scaled}，最近真值 ${m.nearest}，偏差 ${dev}）｜…${m.snippet}…`);
      }
      fail++;
    }
  }
  console.log(fail === 0 ? '\nlive 重放全部通过 ✅' : `\n${fail} 题未过 ❌`);
  return fail === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args.includes('--live')) {
    const urlIdx = args.indexOf('--url');
    const baseUrl = (urlIdx >= 0 ? args[urlIdx + 1] : process.env.REPLAY_URL || 'https://sage.nakocai.com').replace(/\/$/, '');
    const token = process.env.REPLAY_TOKEN;
    const userId = process.env.REPLAY_USER_ID || 'replay-bot';
    if (!token) {
      console.error('live 模式需要 REPLAY_TOKEN 环境变量（与前端登录同源的 accessToken）');
      return 2;
    }
    return runLiveMode({ baseUrl, token, userId });
  }
  return runSampleMode();
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err);
  process.exit(1);
});

// parseNum 引用保持树摇不删（replay 模式可能用于扩展 fixture）
void parseNum;
