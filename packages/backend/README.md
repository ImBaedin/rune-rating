# `@rune-rating/backend`

Convex backend, database schema, reactive API, normalization layer, and current
snapshot refresh orchestration.

The [September 28 atlas readiness review](../../apps/web/ATLAS_READINESS.md)
reproduced a freshness issue that has since been fixed: `achievements.progress`
now checks all contributing categories and collection-detail jobs. Selected
milestone details expose the relevant source timestamps and refresh outcomes.

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

The current player refresh pipeline treats Hiscores as its baseline gate. Wise
Old Man and RuneProfile player jobs are enqueued only after Hiscores commits;
an upstream Hiscores failure marks those downstream states as
`hiscoresUnavailable`. Source adapters log sanitized error codes and messages
for operational diagnosis without logging provider payloads or credentials.

## Achievement atlas

`achievements.load` enrolls a normalized current RSN in the existing refresh
pipeline. The hourly cooldown and provider queue remain authoritative; there are
no per-node upstream requests. RuneProfile must have a successful public snapshot
before personalized results are exposed. `notFound` / `notConnected` immediately
hide prior results, including selected-node evidence.

`achievementProgress` holds one replaceable current result per enrolled player,
keyed by the compiled catalog version and canonical source revisions. Successful
Player refresh finalization queues any stale/missing collection details in the same
transaction, then schedules one rebuild after the refresh lease and collection job
are both settled. Hiscores and RuneProfile intermediate commits do not rebuild.
Collection retries keep the gate closed; completion, terminal failure, and exhausted
job leases release it. Collection-only refreshes use the same gate. An optional
`pendingRebuildId` coalesces pending work and needs no backfill for existing caches.
Enrollment registers interest without evaluating the previous snapshot or fetching
collection details ahead of the player refresh. Repeat reads/refreshes of unchanged
revisions do not re-evaluate.
No raw payloads, unlock dates, or achievement history are retained.

`progress.needsRebuild` identifies missing caches, catalog version changes, and
invalid state-vector lengths. The atlas automatically calls `load` to repair
these from current canonical snapshots; this local rebuild is allowed during
cooldown, while upstream refreshes still use the shared refresh policy.

The public `progress` query returns 973 state characters plus small availability
metadata (under 1.5 KB JSON in the contract test). Detailed evidence is stored in
bounded 32-node chunks, rewritten only when changed, and only the selected node's
result crosses the wire. Invalid combat-task detail remains unknown.

Collection detail has its own `collection:detail` snapshot marker. A new summary
or an old item row cannot make details fresh; an empty complete detail response
can. Detail commits reject older/equal revisions and do not overwrite a newer
summary. This marker is shared with existing collection comparison refreshes.
Existing item rows without the marker receive one fresh detail fetch on demand.

After changing the compiled catalog or evaluator, publish the matching Convex
functions to the intended development environment before validating the browser.
Generating TypeScript bindings or rebuilding Vite alone does not update the running
backend's catalog version. The browser deliberately rejects an older state vector,
even when that player's source snapshots are otherwise valid.

### Atlas prerequisite and source details

The achievement evidence cache now includes the domain evaluator's separate
quest-readiness evidence. Completed milestones keep their completion status.
`achievements.detail` adds live, canonical `sourceFreshness` for the selected
milestone's completion and prerequisite dependencies; these operational statuses
are queried rather than copied into persisted evidence. Skills/activities use
Hiscores; quests, diaries and combat achievements use their RuneProfile category
states. Collection detail uses its own snapshot timestamp and deduplicated queue
job, independently of the collection summary.

`achievements.progress.stale` now considers every contributing category instead of
quests alone. `ready` means a usable current-version state vector exists, not that
all providers succeeded. Saved progress remains visible during partial failures.
Freshness uses the configured refresh cooldown (one hour by default); it does not prove that a
player has recently synced their RuneProfile plugin. Regressions cover fresh
quests with failed Hiscores and a fresh collection summary with old/queued/failed
item-level details.

### Achievement content and read costs

Source commits maintain compact `achievementSources` metadata in the same
transaction as canonical snapshots/items. `fetchedAt` describes freshness;
content hashes describe achievement-relevant changes. The cache guard also
includes catalog version and combat-detail validation state. Unchanged sources
advance freshness without rereading canonical items or evaluating milestones.
Do not add a snapshot/item writer without updating the corresponding source
metadata; maintenance tools must invalidate that metadata when bypassing writers.

`achievementEvidenceIndex` stores bounded chunk IDs and hashes separately from
public progress, so warm rebuilds only replace changed evidence and do not read
all prior chunks. Missing source metadata and evidence indexes use the old live
read path until naturally refreshed/rebuilt; no migration or bulk backfill is
required. Existing public progress/profile endpoints remain available. The atlas
uses `achievements.atlas` to share their player and status reads in one subscription.
Enrollment does not touch existing player records; `lastRequestedAt` now records
accepted refresh requests, not visits or rejected requests.

See [measured savings and limitations](ACHIEVEMENT_PERFORMANCE.md) for the
catalog-sized regression benchmark and reproduction instructions.
