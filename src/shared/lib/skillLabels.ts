/**
 * Official, curated Chinese labels for built-in skills.
 *
 * Skills are listed read-only in the web UI. We never expose the raw internal
 * skill IDs (which carry brand/vendor prefixes) or any vendor names to users;
 * instead every skill is shown with a plain, capability-focused name and a
 * plain-text description of what it does.
 *
 * Keys here are the `name` field returned by the backend (the SKILL.md
 * frontmatter `name`, e.g. "htsc-daily-review-skill"). Unknown skills fall
 * back to their raw name so the panel still renders.
 */

export interface SkillLabel {
  /** User-facing display name, no brand/vendor references. */
  name: string;
  /** Plain-text description of the capability, no brand/vendor references. */
  description: string;
}

const SKILL_LABELS: Record<string, SkillLabel> = {
  'htsc-daily-review-skill': {
    name: 'A股每日复盘',
    description:
      '最近一个交易日或近一周的 A 股市场复盘，包含行情回顾与走势分析',
  },
  'htsc-industry-outlook-skill': {
    name: '行业赛道分析',
    description: '行业与赛道的周度观点，涵盖基本面、短期交易与参考思路',
  },
  'htsc-report-skill': {
    name: '深度研报检索',
    description: '按公司或研究方向获取专业的深度研究报告',
  },
  'htsc-valuation-skill': {
    name: '公司估值与财务',
    description: '估值模型、盈利能力、营收预测与三大财务报表数据',
  },
  'web-access': {
    name: '联网搜索',
    description: '实时检索互联网信息，获取网页内容与最新资讯',
  },
  'westock-market': {
    name: '市场总览',
    description: '热搜股票、板块排行、新股日历、财经事件与北向资金',
  },
  'westock-quote': {
    name: '实时行情',
    description: '实时价格、K线、技术指标、资金流向与机构评级',
  },
  'westock-research': {
    name: '研报与公告',
    description: '个股研报列表、公司公告、市场资讯与新闻',
  },
  'westock-screener': {
    name: '选股与宏观',
    description: '条件选股筛选、指数板块成份与宏观经济数据',
  },
};

/**
 * Resolve a user-facing label for a skill. Falls back to the raw name when the
 * skill is not in the curated set (e.g. a future built-in not yet mapped),
 * so the read-only panel always renders something sensible.
 */
export function getSkillLabel(rawName: string): SkillLabel {
  return SKILL_LABELS[rawName] ?? { name: rawName, description: '' };
}
