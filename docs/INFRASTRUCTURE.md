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
2. **Do not copy APNS/updater/macOS release variables into `sage-web-api`.**
3. **Do not drop Supabase tables without a documented backup and explicit user confirmation.**
4. **Core conversation tables are shared Sage product data, not macOS-only data.**
5. **Legacy/mobile tables are retained but not part of the Web MVP unless this registry is updated.**

## Railway boundary

Current Web API service:

- Service: `sage-web-api`
- Project: `sage`
- Environment: `production`
- Repository: `buuzzy/sage-web`
- Branch: `main`
- Purpose: API backend for Sage Web PMF validation

Retained desktop service:

- Service: `sage`
- Project: `sage`
- Environment: `production`
- Purpose: released macOS / historical desktop backend
- Warning: contains desktop updater/APNS variables and should not receive Web deployments.

See [RAILWAY_SERVICES.md](./RAILWAY_SERVICES.md).

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

1. Confirm Railway linked service is `sage-web-api`.
2. Confirm repo source is `buuzzy/sage-web`, branch `main`.
3. Confirm `SAGE_UPDATER_*` and `APNS_*` are absent from `sage-web-api`.
4. Confirm `/health` responds after deployment.
5. Confirm logs do not expose Supabase JWTs or API keys.
