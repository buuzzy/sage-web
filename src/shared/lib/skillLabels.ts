/**
 * Curated capabilities shown read-only in the web UI.
 *
 * These map to the minishare MCP server's tool categories + the web-access
 * skill. Users see plain Chinese names and capability-focused descriptions.
 * No vendor/brand references anywhere in user-visible text.
 */

export interface SkillLabel {
  /** Stable id for React keys */
  id: string;
  /** User-facing display name */
  name: string;
  /** Plain-text description of the capability */
  description: string;
}

export const CURATED_SKILLS: SkillLabel[] = [
  {
    id: 'market-quote',
    name: '行情数据',
    description: 'A股日K、周K、月K线行情，开盘、收盘、最高、最低与成交量数据',
  },
  {
    id: 'valuation',
    name: '估值指标',
    description: 'PE、PB、换手率、量比、总市值等每日估值与交易指标',
  },
  {
    id: 'financials',
    name: '财务报表',
    description: '利润表、资产负债表、现金流量表完整数据与财务指标分析',
  },
  {
    id: 'forecast-dividend',
    name: '业绩与分红',
    description: '业绩预告、分红送转方案、主要财务指标与审计意见',
  },
  {
    id: 'capital-flow',
    name: '资金与龙虎榜',
    description: '主力资金流向、龙虎榜明细、融资融券余额与大宗交易',
  },
  {
    id: 'fund-etf',
    name: '基金与ETF',
    description: '公募基金与ETF行情、净值、持仓、基金经理与分红数据',
  },
  {
    id: 'news',
    name: '财经新闻',
    description: '实时新闻快讯、重大财经新闻与新闻联播文字稿',
  },
  {
    id: 'research',
    name: '券商研报',
    description: '按公司或研究方向获取最新券商研究报告',
  },
  {
    id: 'announcements',
    name: '公司公告',
    description: '上市公司最新公告、年报季报与重大事项披露',
  },
  {
    id: 'irm-qa',
    name: '董秘问答',
    description: '互动平台上投资者向董秘的提问与回复',
  },
  {
    id: 'policy',
    name: '政策法规',
    description: '国家各部委发布的政策文件与法规信息',
  },
  {
    id: 'web-access',
    name: '联网搜索',
    description: '实时检索互联网信息，获取网页内容与最新资讯',
  },
];
