# 每日热点 Follow-On 问题

> 状态：规划中
> 创建：2026-08-01

## 目标

把首页三个静态能力胶囊替换为每日更新的 A 股热点 follow-on 问题，让用户一进主页就能看到与当日行情/新闻相关的问法，并直接点选发起对话。

## 当前实现（临时）

- `src/app/pages/Home.tsx` 中 `followOnPrompts` 写死 3 条 A 股问题。
- 桌面端横向排列，移动端竖向排列。
- 点击问题后填入输入框，用户可编辑后提交。

## 目标链路

1. T 日 00:00（Asia/Shanghai）在 Railway 触发 cron。
2. 获取 T-1 日 A 股热门新闻 top 10（需确认 minishare MCP 是否暴露 news / major_news 类接口）。
3. 调用 MiniMax-M3 基于新闻生成 3 条 follow-on 问题，限制每条字数（建议 <= 30 字）。
4. 写入存储（建议 Supabase 新增 `daily_picks` 表：`date DATE PRIMARY KEY`、`questions JSONB`、`created_at TIMESTAMPTZ`）。
5. 前端 Home 页查询当日问题；无当日数据时回退到最近一天记录，仍无则显示静态默认问题。

## 待确认

- [ ] minishare MCP 是否提供 A 股新闻接口，返回字段与限流情况
- [ ] 存储方案：Supabase 表 vs API 内存 / 文件
- [ ] 问题格式是否需要话题标签（如「黄金」「新能源」）
- [ ] fallback 文案和兜底策略
- [ ] 生成失败 / LLM 超时的重试策略

## 实施步骤

- [ ] 确认新闻数据源
- [ ] 新增 cron 任务：拉取新闻 + LLM 生成
- [ ] 新增存储与读取接口
- [ ] 前端接入动态问题并保留现有布局
- [ ] 部署 Railway 并验收
