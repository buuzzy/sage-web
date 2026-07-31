# Sage Web Infrastructure Registry

> This document is the entry point for Sage Web infrastructure ownership. Read this before touching Railway, Supabase, Cloudflare, or deployment variables.

## Current product split

| Product line | Repository | Status | Notes |
|---|---|---|---|
| Sage Web | `buuzzy/sage-web` | Current validation mainline | Web-first PMF validation. New development should target this repo unless explicitly stated otherwise. |
| Sage macOS | `buuzzy/sage` | Frozen / retained | Released desktop product and historical backend. Do not deploy Sage Web code here. |
| Sage Legacy | `buuzzy/sage-legacy` | Archive | Earliest macOS/iOS product ideas. Reference only. |

## Non-negotiable rules

1. **Do not deploy `buuzzy/sage-web` code to Railway service `sage`.**
2. **Do not deploy MCP code (`tushare_MCP`) to the `sage` project — it belongs in `minishare-mcp` project (`72cb39ad`).**
3. **Do not copy APNS/updater/macOS release variables into `sage-web-api`.**
4. **Do not drop Supabase tables without a documented backup and explicit user confirmation.**
5. **Core conversation tables are shared Sage product data, not macOS-only data.**
6. **Legacy/mobile tables are retained but not part of the Web MVP unless this registry is updated.**
7. **After any `railway up`, verify the running service by checking logs or endpoint response — never assume deploy succeeded from "Online" status alone.**

## Railway boundary

### `sage` project (`d5dd1df3-18e9-48e3-9cdb-a6334927cc6e`)

- Service: `sage-web-api` (`a16b6f69-0283-407b-b233-897b381a973c`)
  - Public URL: `https://sage.nakocai.com`
  - Repository: `buuzzy/sage-web`, branch `main`
  - Purpose: API backend (Agent runtime) for Sage Web PMF validation

- Service: `sage-web-frontend` (`f132689f-5154-4cfd-b068-4e5bb144be05`)
  - Public URL: `https://app.nakocai.com`

### `minishare-mcp` project (`72cb39ad-858a-49b3-b74b-00a0ce8982d4`)

- Service: `minishare-mcp` (`c1bde52b-d01e-4f5a-8128-e8badfd82226`)
  - Public URL: `https://minishare-mcp-production.up.railway.app`
  - Repository: `buuzzy/tushare_MCP`, branch `main`
  - Purpose: MCP SSE server providing financial data tools to the Agent
  - Connected to `sage-web-api` via `MINISHARE_MCP_URL` env var

> **Critical**: The local Railway CLI defaults to the `sage` project. Always pass explicit `--project 72cb39ad...` when deploying MCP tools.

> **Incident 2026-07-29**: MCP code was accidentally deployed to `sage-web-api` because `railway up` was run from `/private/tmp/tushare_MCP` while the CLI was linked to the `sage` project. This caused a full backend outage (all API routes returned 404). See [RAILWAY_SERVICES.md](./RAILWAY_SERVICES.md) incident log.

See [RAILWAY_SERVICES.md](./RAILWAY_SERVICES.md) and [DATA_FLOW.md](./DATA_FLOW.md).

## Supabase boundary

Sage Web currently reuses shared core tables:

- `profiles`
- `sessions`
- `tasks`
- `messages`
- `files`
- `persona_memory`
- `user_settings`
- `user_behavior`
- `user_providers`
- `sync_state`
- `user_notes`

Legacy/mobile tables are documented but retained.

See [SUPABASE_SCHEMA_REGISTRY.md](./SUPABASE_SCHEMA_REGISTRY.md).

## Cloudflare/domain boundary

Preferred domain split:

| Domain role | Suggested name | Target |
|---|---|---|
| Web frontend | `app.<domain>` or `sage.<domain>` | Web frontend deployment |
| Web API | `api.<domain>` or `sage-api.<domain>` | Railway service `sage-web-api` |

Do not point production Web traffic to the retained desktop service unless explicitly approved.

## Deployment checklist

Before deploying Web API:

1. Run `railway status` to confirm linked project is `sage` and linked service is `sage-web-api`.
2. Confirm `pwd` is `/Users/nakocai/Documents/Projects/sage-web` (not `/private/tmp/tushare_MCP`).
3. Confirm repo source is `buuzzy/sage-web`, branch `main`.
4. Confirm `SAGE_UPDATER_*` and `APNS_*` are absent from `sage-web-api`.
5. After deployment: verify `curl https://sage.nakocai.com/` returns Sage API JSON (not 404).
6. Verify `sage.nakocai.com/agent/title` returns 401 (not 404).
7. Confirm logs do not expose Supabase JWTs or API keys.

Before deploying MCP tools:

1. Run `railway status` to confirm linked project is `minishare-mcp` (`72cb39ad`).
2. If not, pass explicit `--project 72cb39ad-858a-49b3-b74b-00a0ce8982d4 --service c1bde52b-d01e-4f5a-8128-e8badfd82226`.
3. Confirm `pwd` is `/private/tmp/tushare_MCP`.
4. After deployment: verify with MCP SDK (see RAILWAY_SERVICES.md).
