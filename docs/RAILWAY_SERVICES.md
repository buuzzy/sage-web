# Railway Services Registry

> Purpose: prevent future agents from confusing the Web API, the MCP data service, and the historical desktop service.

## Projects overview

| Project | ID | Environment | Purpose |
|---|---|---|---|
| `sage` | `d5dd1df3-18e9-48e3-9cdb-a6334927cc6e` | `production` (`128203a4`) | Sage Web API + Frontend |
| `minishare-mcp` | `72cb39ad-858a-49b3-b74b-00a0ce8982d4` | `production` (`751310b9`) | MCP financial data tools |

## Project: `sage` — Web API & Frontend

### `sage-web-api` (a16b6f69)

| Field | Value |
|---|---|
| Purpose | Sage Web API backend (Agent runtime) |
| Repository | `buuzzy/sage-web` |
| Branch | `main` |
| Public URL | `https://sage.nakocai.com` |
| Service ID | `a16b6f69-0283-407b-b233-897b381a973c` |

Required variable families:

- Runtime: `NODE_ENV`, `RAILWAY_DOCKERFILE_PATH`
- Auth: `SAGE_API_TOKEN`, `SAGE_INTERNAL_TOKEN`
- Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Financial data: `MINISHARE_MCP_URL` (points to MCP SSE endpoint)
- LLM: `ANTHROPIC_BASE_URL`, model API keys

Deploy:
```
railway up --project d5dd1df3-18e9-48e3-9cdb-a6334927cc6e \
  --service a16b6f69-0283-407b-b233-897b381a973c \
  --environment 128203a4-0ad7-4b28-b900-fed680862b14 \
  --detach
```

### `sage-web-frontend` (f132689f)

| Field | Value |
|---|---|
| Purpose | Sage Web frontend (Next.js) |
| Repository | `buuzzy/sage-web` |
| Branch | `main` |
| Public URL | `https://app.nakocai.com` |
| Service ID | `f132689f-5154-4cfd-b068-4e5bb144be05` |

## Project: `minishare-mcp` — MCP Financial Data Tools

### `minishare-mcp` (c1bde52b)

| Field | Value |
|---|---|
| Purpose | MCP SSE server: financial data tools (A-share quotes, financials, news, announcements, fund data) |
| Repository | `buuzzy/tushare_MCP` |
| Branch | `main` |
| Builder | Dockerfile (`python:3.10-slim`) |
| Public URL | `https://minishare-mcp-production.up.railway.app` |
| SSE endpoint | `https://minishare-mcp-production.up.railway.app/sse` |
| Service ID | `c1bde52b-d01e-4f5a-8128-e8badfd82226` |
| Local dev path | `/private/tmp/tushare_MCP` |

Required variables:

- `TINYSHARE_TOKEN` — data API token (quotes/financials)
- `MINISHARE_TOKEN` — corpus API token (news/announcements/research)

Deploy:
```
railway up --project 72cb39ad-858a-49b3-b74b-00a0ce8982d4 \
  --service c1bde52b-d01e-4f5a-8128-e8badfd82226 \
  --environment 751310b9-ad8a-4a26-860b-4a934b795487 \
  --detach
```

> **WARNING**: The local Railway CLI defaults to the `sage` project. Always pass explicit `--project` and `--service` when deploying MCP tools. Failure to do so was the root cause of a multi-day debugging cycle.

## Retained service (deleted)

### `sage`

| Field | Value |
|---|---|
| Purpose | Formerly: released macOS / historical desktop backend |
| Status | **Deleted** (was redeployed with MCP code by mistake; removed 2026-07-29 to avoid confusion) |

## Post-deploy verification protocol

### `sage-web-api` (Sage Web API backend)

After deploying `sage-web-api`, verify it is running the **Sage Web API** code, not MCP code:

```bash
# 1. Root endpoint should return Sage API JSON, not 404
curl -sS https://sage.nakocai.com/
# Expected: {"name":"Sage API","version":"...","endpoints":{...}}
# If 404 or MCP logs → wrong code deployed

# 2. Auth-gated endpoints should return 401, not 404
curl -sS -o /dev/null -w "%{http_code}" https://sage.nakocai.com/agent/title
# Expected: 401 (not 404)

# 3. Check logs for Sage API startup message
railway logs --service sage-web-api | grep "Sage API"
# Expected: "🚀 Sage API starting..."
# If you see "minishare_mcp" or "FastMCP" → wrong code deployed
```

### `minishare-mcp` (MCP data tools)

For `minishare-mcp` deployments, verify with MCP SDK (not just SSE liveness):

```python
import asyncio
from mcp import ClientSession
from mcp.client.sse import sse_client

async def verify():
    async with sse_client("https://minishare-mcp-production.up.railway.app/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool("fina_indicator", {"ts_code": "300760.SZ", "limit": 3})
            for item in result.content:
                if hasattr(item, "text"):
                    print(item.text)

asyncio.run(verify())
```

Check that the output contains the expected fields (e.g., "流动比率" and "速动比率"). If fields are missing, the deployed code does not match local source.

## Incident log

### 2026-07-29: `sage-web-api` overwritten with MCP code

**Symptom**: Frontend showed "无法连接到服务". All API endpoints (`/agent/plan`, `/agent/title`, `/providers/settings/sync`) returned 404.

**Root cause**: While fixing MCP tools in `/private/tmp/tushare_MCP`, a `railway up` was run with the CLI still linked to the `sage` project. The MCP code deployed to `sage-web-api`, replacing the Sage Web API backend. The MCP server (FastMCP on port 8080) responded to HTTP requests but had no knowledge of `/agent/*` or `/providers/*` routes.

**Detection**: Logs showed `minishare_mcp` startup messages instead of `🚀 Sage API starting...`. All route requests returned 404.

**Fix**: Redeployed from `/Users/nakocai/Documents/Projects/sage-web` with `railway up --service sage-web-api --detach`.

**Prevention**: Always run `railway status` before `railway up` to confirm the linked project and service. When deploying from `/private/tmp/tushare_MCP`, always pass explicit `--project 72cb39ad... --service c1bde52b...`.

**Golden rule**: "Online" status on Railway only means the container is running — it does not mean the correct code is deployed. Always verify via endpoint response or log content.
