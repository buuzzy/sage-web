# Railway Services Registry

> Purpose: prevent future agents from confusing the Web API service with the retained macOS/desktop service.

## Project

| Field | Value |
|---|---|
| Railway project name | `sage` |
| Environment | `production` |
| Workspace | `My Projects` |

## Current mainline service

### `sage-web-api`

| Field | Value |
|---|---|
| Purpose | Sage Web API backend |
| Product line | Sage Web PMF validation |
| Repository | `buuzzy/sage-web` |
| Branch | `main` |
| Builder | Dockerfile |
| Dockerfile path | `Dockerfile` |
| Used by | Sage Web frontend |
| Can deploy from this repo? | Yes |
| Desktop updater variables allowed? | No |
| APNS/mobile push variables allowed? | No |

Required variable families:

- Runtime: `NODE_ENV`, `RAILWAY_DOCKERFILE_PATH`
- Auth: `SAGE_API_TOKEN`, `SAGE_INTERNAL_TOKEN`
- Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Financial data: `WESTOCK_API_KEY`, `HTSC_APP_KEY`
- Persona/distillation LLM: `MIMO_*`, `DEEPSEEK_*`
- Optional background jobs: `SAGE_ENABLE_BACKGROUND_JOBS`

Do not set:

- `APNS_*`
- `SAGE_UPDATER_*`
- `SAGE_UPDATER_MANIFEST_JSON`

## Retained service

### `sage`

| Field | Value |
|---|---|
| Purpose | Released macOS / historical desktop backend |
| Product line | Sage macOS |
| Public URL | `https://sage-production-28e1.up.railway.app` |
| Used by | Existing released macOS app and historical desktop flows |
| Can deploy Sage Web code here? | No |
| Contains desktop variables? | Yes |

Warnings:

- This service contains desktop updater and APNS-related variables.
- Do not replace it with `buuzzy/sage-web` code.
- Do not remove updater variables unless explicitly maintaining the macOS product line.

## Operational checks

```bash
railway status
railway service list --json
railway variable list --service sage-web-api --json
railway domain list --service sage-web-api --json
```

When in doubt, stop and verify the linked service before deployment.
