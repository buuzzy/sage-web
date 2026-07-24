# Sage Web MVP Backlog

> 目标：基于 Sage Mac 的能力，逐步补齐 web 版本，但以“先能验证、后做完整”为原则。

## P0 - 先让 Web 可独立运行

| 优先级 | 模块 | 任务 | 参考文件 | 说明 |
|---|---|---|---|---|
| P0 | 启动壳 | 去掉 sidecar readiness 探测 | `src/main.tsx` | 浏览器打开即用，不再等待桌面后端就绪 |
| P0 | 更新器 | 改成 web-safe no-op | `src/shared/providers/update-provider.tsx`、`src/components/settings/tabs/AboutSettings.tsx`、`src/components/layout/left-sidebar.tsx` | Web 版不提供安装/重启更新 |
| P0 | 路由 | 收敛为纯 web 路由 | `src/app/router.tsx` | 暂时移除 mobile shell 分叉 |
| P0 | 主题 | 去掉原生窗口同步 | `src/shared/providers/theme-provider.tsx` | 仅保留浏览器主题切换 |
| P0 | About 页 | 用构建版本替代原生版本读取 | `src/components/settings/tabs/AboutSettings.tsx` | 版本号由 `__APP_VERSION__` 提供 |
| P0 | 外链打开 | 统一浏览器 `window.open` | `src/components/task/VitePreview.tsx`、`src/components/settings/tabs/ModelSettings.tsx`、`src/shared/providers/auth-provider.tsx` | 不依赖 opener plugin |

## P1 - 跑通核心产品链路

| 优先级 | 模块 | 任务 | 参考文件 | 说明 |
|---|---|---|---|---|
| P1 | 登录 | Web OAuth 闭环 | `src/shared/providers/auth-provider.tsx`、`src/shared/lib/supabase.ts` | Supabase in-page login、刷新恢复 |
| P1 | 会话 | 首页 / 任务页 / 历史页稳定 | `src/app/pages/*` | 页面入口保持可访问 |
| P1 | Agent | 聊天 + SSE + plan/execute | `src/shared/hooks/useAgent.ts`、`src/components/home/*`、`src/components/task/*` | 核心任务链路 |
| P1 | 任务详情 | 任务执行过程可解释 | `src/app/pages/TaskDetail.tsx` | 工具调用、错误、输出展示 |
| P1 | 数据 | 浏览器存储与云同步可用 | `src/shared/db/*`、`src/shared/sync/*` | IndexedDB + Supabase |

## P2 - 补齐 Sage 的差异化

| 优先级 | 模块 | 任务 | 参考文件 | 说明 |
|---|---|---|---|---|
| P2 | 记忆 | persona / behavior / profile 展示 | `src/shared/sync/*`、`src-api/src/jobs/distill-persona.ts` | 让用户感受到“它记得我” |
| P2 | 金融 | 核心图表与行情卡片 | `src/components/htui/*` | 先保留高频组件 |
| P2 | 设置 | 模型、数据、关于页可用 | `src/components/settings/*` | 确保 web 也能配置 provider |
| P2 | 导出 | 浏览器下载导出 JSON | `src/components/settings/tabs/DataSettings.tsx` | 替代桌面文件保存 |
| P2 | 埋点 | 关键行为上报 | `src/shared/sync/behavior-sync.ts` | 验证 PMF 必需 |

## P3 - 后置能力

- 高级 Office / 视频 / 音频附件预览
- 本地目录迁移
- 桌面安装包 / updater / notarization
- deep-link
- sidecar / native shell
- 复杂离线模式

## 建议执行节奏

1. **本周**：完成 P0
2. **下一阶段**：完成 P1，形成 web MVP
3. **之后**：按真实反馈决定是否推进 P2
