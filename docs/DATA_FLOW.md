# Sage Web Data Flow

> Purpose: document how data moves from user input through Agent execution to MCP tools and back.

## Architecture diagram

```
User Browser
  │  HTTPS
  ▼
app.nakocai.com (sage-web-frontend, Next.js)
  │  SSE stream (chat messages, tool calls, canvas)
  ▼
sage.nakocai.com (sage-web-api, Node.js)
  │  Agent runtime (AI SDK)
  │  ├── Supabase (auth, sessions, messages, memory)
  │  ├── LLM API (MiniMax-M3 via ANTHROPIC_BASE_URL)
  │  ├── MCP: minishare-mcp (financial data tools)
  │  └── MCP: canvas (render_canvas tool, in-process)
  │
  │  MCP SSE connection (MINISHARE_MCP_URL env var)
  ▼
minishare-mcp-production.up.railway.app (minishare-mcp, Python FastMCP)
  │  TinyShare/MiniShare SDK
  ▼
Tushare data API (quotes, financials, news, announcements, fund data)
```

## Request lifecycle

1. User sends a message in the chat UI at `app.nakocai.com`.
2. Frontend opens an SSE stream to `sage.nakocai.com/agent` (or `/agent/plan` for planning).
3. Backend (`sage-web-api`) receives the message, loads conversation history from Supabase, constructs a system prompt from `AGENTS.md` + `SOUL.md`, and starts the Agent loop.
4. Agent (MiniMax-M3) decides whether to call MCP tools (e.g., `fina_indicator`, `daily`, `anns_d`).
5. Each tool call flows: Agent SDK → MCP SSE client → `minishare-mcp` service → Tushare API → formatted text response.
6. Agent may call `render_canvas` to produce HTML visualizations; these are rendered in iframes on the frontend.
7. Final response (text + canvas) is streamed back to the frontend via SSE.
8. Full conversation is persisted to Supabase (`messages` table).

## Service ownership matrix

| Layer | Service | Railway Project | Service ID | Repo |
|---|---|---|---|---|
| Frontend | `sage-web-frontend` | `sage` | `f132689f` | `buuzzy/sage-web` |
| Backend API | `sage-web-api` | `sage` | `a16b6f69` | `buuzzy/sage-web` |
| MCP Data | `minishare-mcp` | `minishare-mcp` | `c1bde52b` | `buuzzy/tushare_MCP` |
| Database | Supabase (external) | — | — | — |
| LLM | MiniMax-M3 (external) | — | — | — |
| DNS | Cloudflare | — | — | — |

## Key environment variables

### `sage-web-api`

| Variable | Purpose | Example |
|---|---|---|
| `MINISHARE_MCP_URL` | MCP SSE endpoint for financial data tools | `https://minishare-mcp-production.up.railway.app/sse` |
| `ANTHROPIC_BASE_URL` | LLM API base URL | `https://api.minimaxi.com/anthropic` |
| `SUPABASE_URL` | Supabase project URL | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key | — |
| `SAGE_API_TOKEN` | Internal API auth | — |

### `minishare-mcp`

| Variable | Purpose |
|---|---|
| `TINYSHARE_TOKEN` | Data API token (quotes, financials, fund data) |
| `MINISHARE_TOKEN` | Corpus API token (news, announcements, research reports) |
| `PORT` | Server port (defaults to 8000, Railway sets automatically) |

## MCP tool categories

| Category | Tools | Data source |
|---|---|---|
| 行情 | `daily`, `daily_basic`, `weekly`, `monthly`, `moneyflow`, `stk_limit` | Tushare via TINYSHARE_TOKEN |
| 财务 | `fina_indicator`, `balancesheet`, `income`, `cashflow`, `forecast`, `express`, `dividend`, `fina_mainbz` | Tushare via TINYSHARE_TOKEN |
| 语料 | `anns_d`, `news`, `major_news`, `research_report`, `cctv_news` | MiniShare via MINISHARE_TOKEN |
| 基金 | `fund_daily`, `fund_portfolio`, `fund_nav`, `fund_basic` | Tushare via TINYSHARE_TOKEN |
| 互联互通 | `hsgt_top10`, `ggt_top10`, `ggt_daily` | Tushare via TINYSHARE_TOKEN |
| 龙虎榜 | `top_list` | Tushare via TINYSHARE_TOKEN |

## MCP deployment verification

After deploying to `minishare-mcp`, always verify with the MCP Python SDK:

```python
import asyncio
from mcp import ClientSession
from mcp.client.sse import sse_client

async def verify():
    async with sse_client("https://minishare-mcp-production.up.railway.app/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # 1. Verify tool description is updated
            tools = await session.list_tools()
            for t in tools.tools:
                if t.name == "fina_indicator":
                    print(t.description[:200])

            # 2. Verify actual data output
            result = await session.call_tool("fina_indicator", {"ts_code": "300760.SZ", "limit": 3})
            for item in result.content:
                if hasattr(item, "text"):
                    print(item.text)

            # 3. Verify guards
            r = await session.call_tool("fina_indicator", {"ts_code": "300760.SZ", "period": "20251231", "limit": 5})
            for item in r.content:
                if hasattr(item, "text"):
                    print(item.text[:100])

asyncio.run(verify())
```

> **Never** assume a deployment succeeded based solely on the SSE endpoint returning an `event: endpoint` response. That only proves the container is running, not that the latest code is deployed.

## Common failure modes

### `sage-web-api` returns 404 for all routes

**Cause**: MCP code was deployed to `sage-web-api` instead of Sage Web API. The MCP server (FastMCP) listens on HTTP but has no knowledge of `/agent/*`, `/providers/*`, or `/health` routes.

**Detection**:
- `curl https://sage.nakocai.com/` returns 404 (instead of Sage API JSON)
- Logs show `minishare_mcp` or `FastMCP` (instead of `🚀 Sage API starting...`)
- Frontend shows "无法连接到服务"

**Fix**: Redeploy from the sage-web repo: `cd /Users/nakocai/Documents/Projects/sage-web && railway up --service sage-web-api --detach`

### MCP tool returns single period despite `limit` parameter

**Cause**: `period` parameter forces exact-match filtering, which overrides `limit`. When both are passed, `period` wins and returns 1 row.

**Fix**: Use `limit` alone for multi-period trends; use `period` alone for a specific reporting period. Never combine them.
