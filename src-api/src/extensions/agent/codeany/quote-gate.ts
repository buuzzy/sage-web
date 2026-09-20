/**
 * 报价硬门禁（Quote Gate）
 *
 * 模型在没有任何工具调用的情况下给出具体代码/价格 = 大概率编造
 * （2026-09-15 事故：MiniMax-M3 在池冷启动后凭记忆编出港股代码和价格）。
 * 命中即拦截文本并强制模型先调工具核实。刻意保持窄匹配（代码 + 带币种
 * 价格），避免把概念讨论里的百分比/指数点位误伤。
 *
 * 回显排除（2026-09-20 事故）：金融题的开场白几乎必然复述用户问题中的
 * 代码（"查询腾讯控股（00700.HK）…"），此时模型刚起步、还没调工具，
 * 旧逻辑误判为凭记忆报价——每轮都输出"未调用数据工具"警告并触发无意义
 * 的重查（用户单次提问看到两遍完整回答）。现规则：命中的代码/价格若
 * 全部原样出现在用户问题中（纯复述）→ 放行；出现问题中没有的新值 → 拦截。
 *
 * 本模块刻意保持零依赖纯函数，便于回归测试（tests/quote-gate.test.ts）。
 */

export const QUOTE_GATE_PATTERNS: RegExp[] = [
  /\b0\d{4}\b/, // 港股 5 位代码（0 开头）
  /\b[036]\d{5}\b/, // A 股 6 位代码（沪 6 / 深主板 0 含 000xxx·002xxx / 深创 3）
  /\d+(?:\.\d+)?\s*(?:HKD|USD|港元|港币|美元)/i, // 价格 + 币种
];

export function matchesQuoteGate(text: string, userPrompt?: string): boolean {
  return QUOTE_GATE_PATTERNS.some((p) => {
    // 每次新建 global 正则，避免 lastIndex 状态残留
    const hits = text.match(
      new RegExp(p.source, p.flags.includes('g') ? p.flags : p.flags + 'g')
    );
    if (!hits) return false;
    // 全部命中均为复述用户问题中的原值 → 非编造，放行
    if (userPrompt && hits.every((hit) => userPrompt.includes(hit))) return false;
    return true;
  });
}

/** 门禁触发后下发的强制核实指令（仅全程零工具调用时使用） */
export const QUOTE_GATE_VERIFY_PROMPT = [
  '你刚才的回答包含具体股票代码和价格数字，但本轮没有调用任何数据工具，这些数字可能不真实。请立即：',
  '1. 调用 search_symbol（market=all）搜索用户问题中提到的标的名称，确认真实代码与上市地（用户说的市场不一定准确）；',
  '2. 用对应行情工具（hk_daily / us_daily 等）获取真实数据；',
  '3. 基于工具返回的真实数据重新完整回答用户的问题。若搜索不到，明确告知用户。',
].join('\n');

/** 重查后仍无工具调用的兜底提示 */
export const QUOTE_GATE_FALLBACK_NOTICE =
  '\n\n---\n⚠️ 注意：本次回答中的代码/价格未能通过数据工具核实，可能来自模型记忆，请谨慎对待。';

/** 拦截时对用户可见的提示 */
export const QUOTE_GATE_INTERCEPT_NOTICE =
  '⚠️ 检测到回答包含具体股票代码/价格，但本轮未调用数据工具。为避免不实数据，我先核实数据再作答。';
