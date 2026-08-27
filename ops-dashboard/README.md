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

## 部署到 Railway（railway-cli）

完整步骤见本文档末尾。**先在 Railway 上新建一个独立项目**（不要复用 sage 项目的 `d5dd1df3-…`）。

> ⚠️ **必须在仓库根目录执行 `railway up`**（不是 `ops-dashboard/`）。
> Dockerfile 里 `COPY pnpm-lock.yaml pnpm-workspace.yaml` 指向仓库根文件，
> 构建上下文（build context）必须是整个 sage-web 仓库根，
> 再用 `RAILWAY_DOCKERFILE_PATH=ops-dashboard/Dockerfile` 指定用哪个 Dockerfile
> （与 sage-web-api 的部署方式完全同款）。

```bash
# 在仓库根目录
railway init --name sage-ops        # 新建独立项目
railway variables --set "RAILWAY_DOCKERFILE_PATH=ops-dashboard/Dockerfile"
railway variables --set "SUPABASE_URL=https://..."
railway variables --set "SUPABASE_SERVICE_ROLE_KEY=..."
railway variables --set "ADMIN_TOKEN=<长随机 secret>"
railway up --detach
```

（`railway variables` 的具体语法以 `railway variables --help` 为准；也可以直接在
Railway 控制台网页里加变量，效果一样。）

部署成功后 Railway 给你一个 `*.up.railway.app` 域名。打开 → 输入 `ADMIN_TOKEN` → 看数据。

## API 速查

| Method | Path | 说明 |
|---|---|---|
| GET  | `/api/metrics` | 全部看板数据，一次请求装下整页 |
| POST | `/api/codes`   | 生成新兑换码 `{max_uses, note?}` |
| PATCH| `/api/codes/:id`| 停用 / 调整 `{is_active?, max_uses?}` |

所有 `/api/*` 必须 `Authorization: Bearer <ADMIN_TOKEN>`，否则 401。
不接 Supabase JWT，单纯用 ADMIN_TOKEN。

## 部署到 Railway — 完整步骤

1. **确认 railway-cli 已登录**：
   ```bash
   railway whoami
   ```

2. **新建独立 Railway 项目（在仓库根目录执行）**：
   ```bash
   railway init --name sage-ops
   ```
   这会创建一个新项目，不会影响 sage 主项目。

3. **设置环境变量**（CLI 语法以 `railway variables --help` 为准，或直接在 Railway 控制台网页加）：
   ```bash
   railway variables --set "RAILWAY_DOCKERFILE_PATH=ops-dashboard/Dockerfile"
   railway variables --set "SUPABASE_URL=https://wymqgwtagpsjuonsclye.supabase.co"
   railway variables --set "SUPABASE_SERVICE_ROLE_KEY=<service role key>"
   railway variables --set "ADMIN_TOKEN=<新长随机 secret>"
   ```
   `RAILWAY_DOCKERFILE_PATH` 告诉 Railway 用 `ops-dashboard/Dockerfile`（构建上下文仍是仓库根）。

4. **首次部署（必须在仓库根目录）**：
   ```bash
   railway up --detach
   ```

5. **生成公网域名**（如果 Railway 没自动给）：
   ```bash
   railway domain
   ```

6. **验证**：
   ```bash
   # 401 (no token)
   curl https://<your-domain>/api/metrics
   # 200 (with token)
   curl -H "Authorization: Bearer $ADMIN_TOKEN" https://<your-domain>/api/metrics
   ```

7. **浏览器打开域名**，输入 `ADMIN_TOKEN`，看到数据即部署完成。

## 后续运维

- **更新代码**：`git push` 后 `railway up --detach` 触发重新构建部署
- **看日志**：`railway logs`
- **更新变量**：`railway variables set KEY=value`
- **完全拆除**（不想要这个服务）：Railway 控制台删项目，不影响 sage

## 与 sage 主项目的关系

| 维度 | sage | ops-dashboard |
|---|---|---|
| Railway 项目 | `sage` (`d5dd1df3-…`) | `sage-ops`（独立新项目） |
| 公网域名 | `app.nakocai.com` / `sage.nakocai.com` | `*.up.railway.app`（或自有域名） |
| 数据库访问 | sage-web-api 用的同一套 Supabase | 只读，service-role key |
| 代码耦合 | — | 零（独立 package.json / Dockerfile） |
| Schema 改动 | — | 零（不写表、不加触发器） |

简单说：**这是只读观察 Sage 内测期发生了什么的小望远镜**。望远镜坏了不会影响 Sage。