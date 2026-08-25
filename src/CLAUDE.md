# src/ — React 前端

React 19 SPA（纯 Web）。Vite 7 构建，TailwindCSS 4 样式，无全局状态库

## 子目录职责

| 目录 | 职责 | 稳定度 |
|------|------|--------|
| app/pages/ | 4 个页面组件（Home/TaskDetail/Library/Login） | 🔧 可修改 |
| app/pages/task-detail/ | TaskDetail 子组件（MessageList, ErrorMessage, AgentActionBar 等） | 🔧 |
| components/htui/ | 14 个金融可视化组件 | 详见 htui/CLAUDE.md |
| components/ui/ | shadcn/ui 基础组件（button, dialog, sheet, tooltip...） | 🔒 不改接口 |
| components/task/ | 任务渲染（PlanApproval, ToolExecutionItem, QuestionInput） | 🔧 |
| components/settings/ | 设置面板（SettingsModal 渲染 account/general/skills/persona/about 5 个 tab） | 🔧 |
| components/layout/ | 布局（左侧栏 + sidebar context） | 🔧 |
| components/common/ | 通用小组件 | 🔧 |
| shared/ | hooks, db, sync, lib, providers, types | 详见 shared/CLAUDE.md |
| config/ | API 地址 + i18n 多语言 | 🔒 |

## 页面路由（app/router.tsx）

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | Home.tsx | 新对话首页 |
| `/task/:id` | TaskDetail.tsx | 会话详情（消息 + artifact 渲染） |
| `/library` | Library.tsx | 历史会话列表 |
| `/login` | Login.tsx | 登录（邮箱+密码+验证码+邀请码） |

## 状态管理约定

- **无全局状态库**（不用 Redux/Zustand/Jotai）
- 页面级状态用 `useState` / `useRef`
- 跨组件共享用 Context Provider（auth, theme, language, sidebar）
- Agent 通信统一走 `shared/hooks/useAgent.ts`，不在其他地方直接 fetch

## 平台

```typescript
// src/config/index.ts
const RAILWAY_URL = 'https://sage.nakocai.com';
export const API_BASE_URL = import.meta.env.VITE_API_URL || RAILWAY_URL;
```

- 纯 Web 部署（Vite SPA），桌面形态已移除
- 唯一的"平台"维度是视口宽度（`isMobile` / `useIsMobile`），见 `shared/lib/platform.ts`

## 不变量

- 不引入全局状态库
- 组件不直接调 `fetch`，统一走 `useAgent` hook
- 组件不直接读 `import.meta.env`，走 `config/index.ts`
- 新增页面必须注册到 `app/router.tsx`
- 新增 Context Provider 必须包裹在 `main.tsx` 或 `App.tsx`（当前入口是 `main.tsx` + `router.tsx`）
