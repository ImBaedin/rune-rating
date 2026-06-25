# `@rune-rating/backend`

Convex backend, database schema, reactive API, normalization layer, and current
snapshot refresh orchestration.

## Responsibilities

- Define validators, schema, and indexes.
- Expose small public queries and mutations for the web app.
- Use internal actions for external API calls.
- Normalize source DTOs into canonical records.
- Track source availability, freshness, failure, and retry state.
- Enforce player-level refresh leases and the database-configured cooldown.
- Store only current canonical snapshots; successful refreshes replace prior
  data and failed refreshes do not consume cooldown.

RuneProfile summary, quest, diary-tier, and combat-achievement-task data is
stored canonically. Collection-log summary counts are stored with the normal
player refresh; granular collection tabs, pages, and items are fetched
demand-side by the collection page and replace the current canonical collection
snapshot without retaining provider history or raw payloads.

RuneProfile account summary data is also the preferred source for account type
identity, including Group Ironman detection via `accountType` and `groupName`.
Wise Old Man account type remains a fallback for older or unavailable
RuneProfile snapshots.

RuneRating recalculates Group Ironman efficiency with cached Wise Old Man
ironman rates. The cache stores transformed rate tables only, refreshes
opportunistically during WOM player refreshes, and falls back to WOM player
totals when rates are unavailable.

## Module Layout

```text
convex/
  schema.ts
  players.ts          # public single-player queries
  comparisons.ts      # public comparison read models
  runeRating.ts       # single-player rating card read model
  runeProfile.ts      # RuneProfile category and collection read models
  wiseOldMan.ts       # WOM overview, gains, timelines, and cache actions
  refresh.ts          # public request + internal orchestration
  sources/            # source action adapters
  lib/                # shared lookup, config, analytics, and key helpers
  policies/           # ownership, cooldown, retry, snapshot planning
```

## Public API Targets

- `players.getProfile({ rsn })`
- `comparisons.getSkills({ leftRsn, rightRsn })`
- `wiseOldMan.getSkillGains({ leftRsn, rightRsn, period })`
- `wiseOldMan.getSkillTimeline({ leftRsn, rightRsn, skillKey, period })`
- `runeProfile.getDashboard({ leftRsn, rightRsn })`
- `runeRating.get({ rsn })`
- `refresh.request({ rsns })`

Every Convex function must define argument and return validators. Queries must
use indexes rather than in-memory filters. Sensitive orchestration and writes
must remain internal.

## Analytics Environment

Backend observability emits explicit PostHog events from actions and scheduled
internal actions. Configure these in the Convex deployment environment:

```bash
POSTHOG_PROJECT_TOKEN=
POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_ENVIRONMENT=production
POSTHOG_DISABLED=false
```

Backend analytics may include hashed normalized RSNs, source/category names,
status enums, error codes, and duration buckets or values. Do not send raw
provider payloads, full canonical snapshots, or raw RSNs.

## Refresh State Machine

```text
missing/stale -> scheduled -> refreshing -> fresh + cooldown
                              |
                              +-> failed / rateLimited / notFound
                                  (lease released, cooldown unchanged)
```

Actions must be safe to retry. Internal mutations use the player lease request
ID to prevent older fetches from overwriting newer snapshots.
