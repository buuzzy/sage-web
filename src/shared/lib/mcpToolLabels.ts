// Maps internal MCP tool names to user-friendly Chinese display labels.
// Keeps technical identifiers (like mcp__minishare__daily) out of the UI.

const MCP_TOOL_LABELS: Record<string, string> = {
  // Market data
  daily: '行情查询',
  weekly: '行情查询',
  monthly: '行情查询',
  daily_basic: '行情指标',
  stk_factor: '因子数据',
  adj_factor: '复权数据',
  // Financial statements
  income: '利润表',
  balancesheet: '资产负债表',
  cashflow: '现金流量表',
  // Financial indicators
  fina_indicator: '财务指标',
  forecast: '业绩预告',
  dividend: '分红数据',
  // Market flow
  moneyflow: '资金流向',
  top_list: '龙虎榜',
  top_inst: '机构席位',
  margin_detail: '融资融券',
  // Corporate data
  pledge_stat: '股权质押',
  repurchase: '回购数据',
  stk_holdernumber: '股东户数',
  stk_managers: '高管信息',
  // Fund data
  fund_daily: '基金行情',
  fund_nav: '基金净值',
  fund_portfolio: '基金持仓',
  fund_share: '基金份额',
  // Basic info
  stock_basic: '股票列表',
  new_share: '新股数据',
  bak_basic: '基础信息',
  // News and corpus
  news: '资讯搜索',
  major_news: '财经快讯',
  cctv_news: '新闻联播',
  research_report: '研报搜索',
  anns_d: '公告查询',
  irm_qa: '互动问答',
  npr: '法规查询',
};

export function getMcpToolDisplayName(toolName: string): string {
  if (!toolName) return '工具调用';
  if (toolName.startsWith('mcp__')) {
    const parts = toolName.split('__');
    const tool = parts[2] || '';
    return MCP_TOOL_LABELS[tool] || '工具调用';
  }
  return toolName;
}
