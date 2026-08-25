# src-api/ — Hono HTTP 后端

独立 pnpm workspace 包（`"sage-api"`）。Railway 云端服务（web 产品唯一后端）。

## 架构分层

```
index.ts (Hono server 入口)
  → app/api/        HTTP 路由层（薄，不含业务逻辑）
  → app/middleware/  中间件（CORS, local-only 鉴权）
  → shared/services/ 业务服务层（组装 agent/chat 逻辑）
  → core/           抽象接口层（agent/sandbox 的 interface + registry）
  → extensions/     具体实现层（codeany adapter, native sandbox provider）
  → shared/         基础设施（context, memory, provider, skills, supabase, utils）
  → jobs/           后台 cron 任务（persona 蒸馏）
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
| /internal/distill-cron | internal-distill.ts | POST | 手动触发蒸馏（Bearer SAGE_INTERNAL_TOKEN） |
| /mcp | mcp.ts | POST | 通用 MCP 端点（仅本地 dev；云端 404） |

## 子目录详细文档

| 目录 | 详见 |
|------|------|
| extensions/agent/codeany/ | `extensions/agent/codeany/CLAUDE.md` |
| shared/ | `shared/CLAUDE.md` |

## 构建命令

```bash
pnpm dev:api                    # tsx --watch 开发模式
pnpm build                      # tsc 编译 → dist/
pnpm bundle                     # esbuild 打包 → dist/bundle.cjs（Railway Dockerfile 用）
```

## 中间件链路

```
请求 → CORS → local-only 鉴权 → 路由 handler

local-only 鉴权（SAGE_API_TOKEN 已配置 = 云端模式）：
  Bearer == SAGE_API_TOKEN   → service 身份（服务间调用）
  Bearer 为合法 Supabase JWT → user 身份（web 前端请求，authKind=user + userId）
  其余                       → 401
未配置 SAGE_API_TOKEN（本地 dev）：
  仅允许 loopback 来源
```

`/mcp`、`/skills/config`、`/skills/toggle` 额外套一层 `localFeatureGuard`：
云端模式直接 404（这些是本地 dev 专属功能）。

## 后台任务

`jobs/scheduler.ts` 在启动时注册 persona 蒸馏 cron（每天 02:00 Asia/Shanghai）。
注册条件：`SUPABASE_SERVICE_ROLE_KEY` + `MINIMAX_API_KEY` 均已配置（本地 dev
缺 service-role key 时自然跳过）。

## 不变量

- 所有路由必须经过 local-only 中间件
- SSE stream 格式：`data: {type, ...}\n\n`，最后必须有 `{type: "done"}`
- 路由层不写业务逻辑，委托给 `shared/services/`
- 新增路由必须注册到 `app/api/index.ts`
- 不在后端硬编码 API Key，全走环境变量
- Supabase 访问双模式：service-role（后台任务，必须显式 .eq('user_id')）/ user-JWT（用户请求，RLS 自动隔离）
