# src-api/ — Hono HTTP 后端

独立 pnpm workspace 包（`"sage-api"`）。Railway 云端服务（web 产品唯一后端；桌面 Tauri sidecar 形态已冻结）。

## 架构分层

```
index.ts (Hono server 入口)
  → app/api/        HTTP 路由层（薄，不含业务逻辑）
  → app/middleware/  中间件（CORS, local-only 鉴权）
  → shared/services/ 业务服务层（组装 agent/chat/preview 逻辑）
  → core/           抽象接口层（agent/sandbox 的 interface + registry）
  → extensions/     具体实现层（codeany adapter, sandbox providers）
  → shared/         基础设施（context, memory, provider, skills, supabase, utils）
  → jobs/           后台 cron 任务
  → config/         常量 + 配置加载
```

## API 路由一览（app/api/）

| 路由 | 文件 | 方法 | 说明 |
|------|------|------|------|
| /agent | agent.ts | POST | Agent 直接执行（单路径，SSE stream） |
| /agent/title | agent.ts | POST | 异步生成对话标题 |
| /mcp/memory | mcp-memory.ts | POST | MCP search_memory 工具 |
| /persona/memory | persona.ts | GET | 当前用户 persona_memory 读取 |
| /health | health.ts | GET | 健康检查 |
| /skills | skills.ts | GET/POST | 技能管理 |
| /providers | providers.ts | GET/POST | 模型 provider 配置（旧，本地模式） |
| /cron | cron.ts | GET/POST/DELETE | 定时任务管理 |
| /files | files.ts | GET/POST | 文件管理 + GitHub skill 导入 |
| /sandbox | sandbox.ts | POST | 沙箱执行 |
| /preview | preview.ts | GET | Vite 预览 |
| /internal/distill | internal-distill.ts | POST | 手动触发蒸馏 |
| /mcp | mcp.ts | POST | 通用 MCP 端点 |

## 子目录详细文档

| 目录 | 详见 |
|------|------|
| extensions/agent/codeany/ | `extensions/agent/codeany/CLAUDE.md` |
| shared/ | `shared/CLAUDE.md` |

## 构建命令

```bash
pnpm dev:api                    # tsx --watch 开发模式
pnpm build                      # tsc 编译 → dist/
pnpm bundle                     # esbuild 打包 → dist/bundle.cjs
pnpm build:binary:mac-arm       # pkg 生成独立二进制
pnpm build:binary:mac-intel     # Intel macOS 二进制
```

## 中间件链路

```
请求 → CORS → local-only（SAGE_API_TOKEN 或 loopback 检测） → 路由 handler
```

## 不变量

- 所有路由必须经过 local-only 中间件
- SSE stream 格式：`data: {type, ...}\n\n`，最后必须有 `{type: "done"}`
- 路由层不写业务逻辑，委托给 `shared/services/`
- 新增路由必须注册到 `app/api/index.ts`
- 不在后端硬编码 API Key，全走环境变量
- 桌面端和 Railway 共用同一套代码，通过环境变量区分行为
