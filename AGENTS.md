# Sage Web — Codex 项目笔记

## 协作规则

- 这是 Sage 的 web-first 新仓库。
- 目标是尽快验证 PMF，因此优先 web 体验与迭代速度。
- 当前阶段保留 macOS 项目在本地冻结，不要把桌面专属逻辑再带回主线。
- 任何代码/配置改动仍需遵守“先讨论、后实施”的原则。

## 项目定位

Sage Web 不是 macOS 桌面壳的搬运版，而是：
- 面向更多用户的浏览器入口
- 用于快速验证使用场景与人群
- 复用现有 Agent、记忆、金融能力与后端 API

## 迁移边界

### 优先复用
- `src/` 前端业务逻辑
- `src-api/` 后端 API 与 Agent 运行时
- `supabase/` 数据模型与迁移
- `configs/` 配置模板
- `public/` 静态资源
- `README.md`、`PRIVACY.md`、`docs/` 等文档资产

### 暂缓迁移
- `src-tauri/`
- 签名 / 公证 / updater 流程
- 本地安装包与桌面分发脚本
- 任何依赖 macOS filesystem / deep-link / window / updater 的逻辑

## 关键原则

1. 先让 web 端能跑，再逐步移除桌面依赖。
2. 不要为了抽象而抽象，先服务 PMF 验证。
3. 保留现有核心能力：Agent、记忆、金融可视化、Supabase 同步。
4. 所有 web-first 改造都要明确区分“必须改”与“可暂缓”。
