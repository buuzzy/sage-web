# ops-dashboard

Sage 内测期运营看板。独立部署、独立 Railway 项目，**不与 sage 主项目（`d5dd1df3-…`）混在一起**。

## 它做什么

只读 Supabase 的 `public.profiles` / `invite_codes` / `code_redemptions` / `user_behavior` 四张表，做统计聚合，渲染一个带 ADMIN_TOKEN 门禁的私密网页：

- 总览卡片（注册、激活、今日 DAU、近 7 天提问）
- 核心漏斗（注册 → 兑换 → 首次提问 → 次日回访 → 7 日留存）
- 留存 Cohort（按激活周分组）
- 近 30 天活跃趋势 + 兑换柱状
- 功能使用分布（`skill_used` / `asset_mentions` Top20）
- 兑换码管理（生成 / 停用 / 复制）
- 最近注册 / 最近兑换流水

不写任何业务表，不动 Sage 主项目的任何代码。

## 本地开发

```bash
# 在仓库根目录
pnpm install                                # 装 sage-api + ops-dashboard + ops-dashboard-web

# 准备环境变量（用 sage-web-api 现有的 Supabase 凭据即可）
cp ops-dashboard/.env.example ops-dashboard/.env
# 编辑 ops-dashboard/.env：
#   SUPABASE_URL=https://<your>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=<service role key>
#   ADMIN_TOKEN=any-long-random-string

# 启动后端（Hono, 端口 2027）
cd ops-dashboard && pnpm dev

# 另开终端，启动前端（Vite, 端口 1421，自动代理 /api → 2027）
cd ops-dashboard/web && pnpm dev
```

打开 http://localhost:1421 输入 `ADMIN_TOKEN` 即可。

## 生产构建（不用 Docker，本地验证用）

```bash
# 后端单文件 bundle
cd ops-dashboard && pnpm build     # → ops-dashboard/dist/bundle.cjs

# 前端静态文件
cd ops-dashboard/web && pnpm build # → ops-dashboard/web/dist/

# 本地起 bundle + 静态
cd ops-dashboard
node dist/bundle.cjs                # 监听 2027，静态前端来自 web/dist/
```

## 部署（Railway）

**已于 2026-08-29 部署上线**，独立项目 `sage-ops`（非 sage 主项目）：

| 项 | 值 |
|---|---|
| URL | https://ops-dashboard-production-44fb.up.railway.app |
| Railway 项目 ID | `1f39c738-b3ad-492e-b8a9-aac6a14c242e` |
| 服务 ID | `e7d66b22-5d34-410d-ac6f-ba0a8c4ce2b2` |
| 环境 | `production` (`b61b7be1-82f3-4598-b769-2a119cf74cb5`) |

**更新部署**（在**仓库根目录**执行——Dockerfile 的构建上下文是仓库根，不是 ops-dashboard/；
始终传显式 ID，绝不依赖目录 link 状态，避免误部署到 sage 项目）：

```bash
railway up --project 1f39c738-b3ad-492e-b8a9-aac6a14c242e \
           --service e7d66b22-5d34-410d-ac6f-ba0a8c4ce2b2 \
           --environment b61b7be1-82f3-4598-b769-2a119cf74cb5 \
           --detach
```

环境变量在 Railway 控制台或 `railway variables --set "KEY=value" --project … --service …` 管理。
详见 `docs/RAILWAY_SERVICES.md` 的 `sage-ops` 条目。

## API 速查

| Method | Path | 说明 |
|---|---|---|
| GET  | `/api/metrics` | 全部看板数据，一次请求装下整页 |
| POST | `/api/codes`   | 生成新兑换码 `{max_uses, note?}` |
| PATCH| `/api/codes/:id`| 停用 / 调整 `{is_active?, max_uses?}` |

所有 `/api/*` 必须 `Authorization: Bearer <ADMIN_TOKEN>`，否则 401。
不接 Supabase JWT，单纯用 ADMIN_TOKEN。

## 后续运维

- **更新代码**：上面「更新部署」命令（改完代码在仓库根执行）
- **看日志**：`railway logs --project <id> --service <id>`
- **更新变量**：Railway 控制台或 `railway variables --set`（变量改动会触发自动重新部署）
- **完全拆除**（不想要这个服务）：Railway 控制台删 `sage-ops` 项目，不影响 sage

## 与 sage 主项目的关系

| 维度 | sage | ops-dashboard |
|---|---|---|
| Railway 项目 | `sage` (`d5dd1df3-…`) | `sage-ops` (`1f39c738-…`) |
| 公网域名 | `app.nakocai.com` / `sage.nakocai.com` | `ops-dashboard-production-44fb.up.railway.app` |
| 数据库访问 | sage-web-api 用的同一套 Supabase | 只读，service-role key |
| 代码耦合 | — | 零（独立 package.json / Dockerfile） |
| Schema 改动 | — | 零（不写表、不加触发器） |

简单说：**这是只读观察 Sage 内测期发生了什么的小望远镜**。望远镜坏了不会影响 Sage。