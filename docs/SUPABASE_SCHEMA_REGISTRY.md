# Supabase Schema Registry

> Purpose: document which tables belong to the current Sage Web/shared core versus retained legacy/mobile systems. This is not a deletion plan.

## Guiding principle

Sage Web should reuse shared core conversation and memory tables. Do **not** create `web_messages`, `web_sessions`, or `web_tasks` just to distinguish platforms. That would fragment memory, search, sync, and future cross-device continuity.

Only create `web_*` tables for truly Web-specific product analytics or onboarding data.

## Shared core tables — active for Sage Web

| Table | Ownership | Used by Web MVP? | Purpose |
|---|---|---:|---|
| `profiles` | Shared core | Yes | User profile extension for Supabase auth users. |
| `sessions` | Shared core | Yes | Conversation/session metadata. |
| `tasks` | Shared core | Yes | Agent task metadata and status. |
| `messages` | Shared core | Yes | Full conversation messages and tool traces. |
| `files` | Shared core | Yes/partial | File/artifact metadata. Web attachment handling may evolve. |
| `persona_memory` | Shared core | Yes | Distilled user memory/persona. |
| `user_settings` | Shared core | Yes | User-level settings backup/sync. |
| `user_behavior` | Shared core | Yes | Behavior events used for memory and PMF observation. |
| `user_providers` | Shared core | Yes | User model provider configuration. |
| `sync_state` | Shared core | Yes/partial | Sync bookkeeping. |
| `user_notes` | Shared core | Yes/partial | User-authored memory notes. |
| `error_logs` | Shared core | Yes/partial | Client error reports. |

## Web-specific future tables — create only when needed

Suggested names if/when required:

| Table | Purpose |
|---|---|
| `web_events` | Product analytics events for Web PMF validation. |
| `web_feedback` | In-product user feedback. |
| `web_onboarding_responses` | Onboarding survey answers. |

## Retained / legacy-mobile tables — not Web MVP mainline

| Table | Status | Notes |
|---|---|---|
| `idea_notes` | Retained legacy/mobile | Historical investment idea capture. Do not reuse without redesign. |
| `mobile_actions` | Retained legacy/mobile | Historical iOS/mobile action lifecycle. Not Web MVP. |
| `mobile_device_tokens` | Retained legacy/mobile | Push notification tokens. Not Web MVP. |
| `user_watchlist` | Retained / optional future | Could be redesigned for Web later; not required for initial MVP. |
| `investment_board_events` | Retained legacy/mobile | Historical investment board event stream. Not Web MVP. |

## Safe documentation migration idea

A future non-destructive migration can add Postgres comments:

```sql
COMMENT ON TABLE public.messages IS 'Sage shared core: conversation messages used by Sage Web and future clients.';
COMMENT ON TABLE public.mobile_actions IS 'Retained legacy/mobile table. Not used by Sage Web MVP.';
```

Do not drop tables as part of comment/documentation migrations.

## Cleanup policy

Before deleting any Supabase table:

1. Confirm no current code references it.
2. Confirm Railway jobs do not reference it.
3. Export/backup table data.
4. Create a destructive migration with clear rollback notes.
5. Get explicit user approval naming the exact table(s).
