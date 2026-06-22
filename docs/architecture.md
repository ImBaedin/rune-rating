# RuneRating Architecture

## Confirmed Normalization And Storage Policy

The following decisions supersede any older conflicting detail later in this
document. The finalized normalization proposal is also presented in
[`a.html`](../a.html).

- RuneRating identity is the normalized current RSN. Account continuity across
  name changes is out of scope.
- Persist only current canonical snapshots. Successful refreshes replace prior
  data; do not store RuneRating history, raw payloads, or source-observation
  archives.
- Fetch provider-owned history on demand without persisting it.
- Hiscores owns every canonical metric it shares with another source.
- Unknown and non-owner values are never persisted.
- Rich categories use current indexed canonical item rows so users can search
  and compare specific collection items, quests, diaries, and combat tasks.
- Enforce a database-configurable refresh cooldown, initially one successful
  snapshot refresh per normalized RSN per hour.
- Implement complete official Hiscores coverage before adding other providers;
  assume no provider API keys initially.

## 1. Architecture Overview

RuneRating uses TanStack Start as the web application and Convex as the backend,
database, reactive query layer, and job system.

The browser subscribes to canonical Convex queries. A comparison request first
returns the best cached result available. If required player/source data is
missing or stale, a mutation schedules internal refresh work. Convex actions
call thin source SDKs, validate the responses, normalize them, and atomically
replace current canonical snapshots. Reactive queries then update the UI as
each source completes. Provider history is fetched and transformed on demand
without being persisted by RuneRating.

The critical boundary is:

- Source SDKs understand transport and source DTOs.
- Convex understands refresh policy, normalization, persistence, and retries.
- The domain package understands canonical types and comparison semantics.
- The web app understands presentation and interaction.

Do not make TanStack Start server functions a second backend. Use them only when
SSR or HTTP-specific behavior requires them; application data should flow
through Convex.

### Explicit Assumptions

- Comparing players does not require authentication in the MVP.
- RSNs are case-insensitive identifiers but preserve the latest display casing;
  normalized current RSN is the only RuneRating player identity.
- External source contracts and rate limits are unstable and must be isolated.
- Wise Old Man and RuneProfile may have no record for an otherwise valid player.
- The OSRS hiscores endpoint is the baseline identity/source check, not an
  infallible account directory.
- RuneRating stores no history, raw payloads, or source-observation archives.

## 2. Canonical Data Model

Canonical records use source-independent metric keys and always carry provenance.
Concrete Convex validators belong in `packages/backend/convex/schema.ts`; shared
read models belong in `packages/domain`.

### Core Documents

| Document | Important fields | Purpose |
| --- | --- | --- |
| `players` | `normalizedRsn`, `displayRsn`, `lastRequestedAt`, `lastSnapshotAt`, `refreshAllowedAt` | Current RSN identity and player-level refresh gate |
| `snapshotStates` | `playerId`, `source`, `category`, `activeRevision`, `status`, `lastAttemptAt`, `lastSuccessAt`, `errorCode` | Availability, freshness, and active granular revision |
| `categorySnapshots` | `playerId`, `category`, `segment`, `fetchedAt`, `source`, `data`, `completeness` | Current bounded canonical documents |
| `canonicalItems` | `playerId`, `category`, `revision`, `canonicalKey`, `state`, `quantity`, `source` | Current granular player facts |
| `canonicalDefinitions` | `category`, `canonicalKey`, `label`, `group` | Searchable canonical item/task catalog |
| `refreshLeases` | `playerId`, `leaseUntil`, `requestId` | Prevent concurrent player refresh sessions |
| `runtimeConfig` | `refreshCooldownMs`, `enabledSources` | Database-managed operational policy |

Comparison results should be computed from stored canonical records, not stored
as permanent truth. A short-lived materialized comparison cache may be added
only after profiling demonstrates a need.

### Canonical Shapes

```ts
type Source = "hiscores" | "wiseOldMan" | "runeProfile";
type SourceStatus =
  | "available"
  | "notConnected"
  | "notFound"
  | "rateLimited"
  | "failed"
  | "unknown";
type Freshness = "fresh" | "stale" | "expired" | "missing";

type Provenance = {
  source: Source;
  fetchedAt: number;
};

type Metric<T> = {
  value: T | null;
  provenance: Provenance;
  confidence: "confirmed" | "derived" | "partial";
};

type CanonicalSkill = {
  skill: string;
  level: Metric<number>;
  xp: Metric<number>;
  rank: Metric<number>;
};

type SourceState = {
  source: Source;
  category: string;
  activeRevision: string | null;
  status: SourceStatus;
  freshness: Freshness;
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  staleAt: number | null;
  expiresAt: number | null;
  nextRetryAt: number | null;
  errorCode: string | null;
};
```

Use `null` for unavailable values. Zero is a real result and must never represent
missing data. Each metric should identify its source and whether it is directly
observed, derived, or based on incomplete coverage.

### Indexes

At minimum:

- `players.by_normalized_rsn`
- `players.by_refresh_allowed_at`
- `snapshotStates.by_player_source_and_category`
- `categorySnapshots.by_player_category_and_segment`
- `canonicalItems.by_player_category_revision_and_key`
- `canonicalItems.by_player_category_revision_and_group`
- `canonicalDefinitions.by_category_and_key`
- `canonicalDefinitions.search_label`
- `refreshLeases.by_player`

## 3. External Source Integration

Each SDK exposes a narrow, typed client:

```ts
interface PlayerSourceClient<TProfile> {
  fetchProfile(rsn: string, signal?: AbortSignal): Promise<TProfile>;
}
```

SDK responsibilities:

- Build requests, set timeouts, and parse source responses.
- Validate source DTOs at the boundary.
- Map HTTP/source failures into a small shared error taxonomy.
- Expose rate-limit hints when available.
- Avoid persistence, retries, normalization, and cross-source merging.

Convex action responsibilities:

- Acquire a per-player/source refresh lease.
- Call the SDK and enforce source-specific timeout/retry policy.
- Normalize the validated DTO into canonical write commands.
- Commit snapshot and source-state updates through internal mutations.
- Release the lease and schedule a retry when appropriate.

Keep source fixtures in each SDK package. Contract tests should detect response
shape drift before it reaches normalization.

## 4. Caching And Refresh

Use stale-while-revalidate behavior:

1. Query current canonical records immediately.
2. Return `snapshotStates` with the data so the UI can explain its quality.
3. A client mutation requests a player snapshot refresh.
4. The mutation schedules internal actions only when no valid player lease
   exists and the configured cooldown permits it.
5. Successful actions normalize and replace current data; subscriptions update
   live.

The refresh cooldown is database-configurable and initially permits one
successful snapshot refresh per normalized RSN per hour. Hiscores owns every
shared canonical metric.

`stale` data remains visible with a timestamp while a refresh runs. `expired`
data may remain visible only with an explicit warning. `missing` data renders a
source-specific empty state. Backoff should include jitter and honor retry-after
headers. Do not retry `notConnected` aggressively; recheck it on a long TTL or a
manual refresh.

Do not broadly poll known players or delete dormant player snapshots. Retry only
recently requested work when appropriate and respect provider rate-limit hints.

## 5. Comparison Logic

Comparison functions accept two canonical profiles and emit:

- the metric for player A and player B
- signed and absolute delta
- leader: A, B, tie, or indeterminate
- coverage and source provenance for both sides
- a short explanation when the result is indeterminate

Rules:

- Compare only semantically equivalent canonical metrics.
- Never rank missing data below real data.
- Mark a card `partial` when either side has incomplete coverage.
- Keep raw totals separate from efficiency metrics; they answer different
  questions.
- Use category-specific weighting only in explicitly labeled summary scores.
- Make the overall "who is ahead" summary transparent and decomposable. For MVP,
  prefer a set of category leaders over one opaque global score.

When one player has more complete data, show supported metrics normally and
de-emphasize only dependent components. The incomplete player's area should be
blurred or muted enough to signal the gap, but the explanation and reconnect/
refresh state must remain readable. Never blur the whole page.

## 6. UI Pages And Routes

```text
/
  Landing/search and recent local comparisons
/compare/$leftRsn/$rightRsn
  Shared comparison shell and Overview
/compare/$leftRsn/$rightRsn/skills
/compare/$leftRsn/$rightRsn/xp-timeline
/compare/$leftRsn/$rightRsn/efficiency
/compare/$leftRsn/$rightRsn/activity
/compare/$leftRsn/$rightRsn/quests
/compare/$leftRsn/$rightRsn/achievement-diaries
/compare/$leftRsn/$rightRsn/bossing
/compare/$leftRsn/$rightRsn/clues
/compare/$leftRsn/$rightRsn/minigames
/compare/$leftRsn/$rightRsn/collections
/compare/$leftRsn/$rightRsn/raw-xp
/settings
```

The comparison shell owns the persistent left sidebar, RSN swap/edit controls,
source/freshness strip, and matched player summary headers. Child routes own
category-specific queries and presentation.

### Overview Composition

- Two aligned account summary panels
- Freshness and source-coverage strip
- Category leader summary, with methodology link
- Total level, total XP, EHP, quest, and diary comparison cards
- Vertically aligned or shared-domain XP charts
- Skill-by-skill comparison table
- Recent activity panel

The visual direction is restrained analytical publishing: neutral surfaces,
strong typographic hierarchy, compact tables, deliberate accent colors for each
player, and very limited decorative effects. Do not use OSRS textures, medieval
ornament, or game-like chrome.

## 7. Folder And Module Structure

```text
apps/
  web/
    src/
      routes/
      features/comparison/
      components/
      lib/convex/
      styles/
packages/
  backend/
    convex/
      schema.ts
      players.ts
      comparisons.ts
      refresh.ts
      crons.ts
      sources/
      normalization/
      policies/
  domain/
    src/models/
    src/comparison/
    src/metric-keys/
  ui/
    src/primitives/
    src/dashboard/
    src/charts/
  sdk-hiscores/
  sdk-wise-old-man/
  sdk-runeprofile/
  config-typescript/
docs/
```

Avoid a generic `utils` dumping ground. Put behavior with its domain and keep
backend public functions thin over internal domain operations.

## 8. Phased MVP Plan

### Phase 0: Contracts And Fixtures

- Confirm API terms, rate limits, authentication, and representative fixtures.
- Define canonical metric keys and source error taxonomy.
- Define canonical metric keys, static source ownership, and refresh policy.

### Phase 1: Vertical Slice

- Generate the TanStack Start app and Convex backend.
- Implement RSN search, hiscores SDK, normalization, current snapshot cache, and
  side-by-side Overview.
- Add source-state UI and refresh leases.

### Phase 2: Multi-Source Comparison

- Add Wise Old Man and RuneProfile SDKs.
- Add EHP, quests, diaries, and partial-data states.
- Add category leader summaries with transparent comparison rules.

### Phase 3: Granular Data And Provider History

- Add current granular canonical rows, item search, and remaining sidebar
  categories.
- Add provider-history passthrough actions and operational dashboards.

### Phase 4: Hardening

- Contract tests, normalization fixtures, browser flow tests, accessibility,
  performance budgets, rate-limit testing, and deployment runbooks.

## 9. Risks And Guardrails

| Risk | Guardrail |
| --- | --- |
| Undocumented API changes | Validate DTOs, keep fixtures, alert on parse failures |
| Rate limits and accidental fan-out | Leases, per-source TTLs, demand-driven refresh, backoff |
| Misleading comparisons | Null-aware comparisons, provenance, visible coverage |
| Partial granular replacement | Revisioned writes and atomic active-revision swap |
| Conflicting source values | Static ownership map; Hiscores owns all overlaps |
| Convex action duplication | Idempotent internal mutations and refresh leases |
| Query payload growth | Category-specific queries and chart aggregation |
| UI density harming clarity | Shared alignment, stable hierarchy, progressive detail |
| Overusing SSR as another data layer | Keep Convex as the application API |
| Legal/terms risk | Verify source terms before implementation and document limits |
