# Architecture Decisions

This is a lightweight decision log. Add an entry when a choice affects multiple
packages or would be expensive to reverse.

## Accepted

### ADR-001: Convex Is The Application Backend

TanStack Start handles routing, rendering, and HTTP-specific concerns. Convex
owns application data, external fetch orchestration, normalization, caching,
and reactive updates. This avoids two competing backend layers.

### ADR-002: Canonical Models Cross Package Boundaries

External source DTOs remain private to their SDK and backend normalization
modules. The web app consumes only source-independent canonical read models.

### ADR-003: Comparisons Are Derived

Comparison output is computed from canonical player data. It is not the primary
stored record because freshness and coverage change independently per player.

### ADR-004: Missing Is Not Zero

Canonical metrics represent unavailable values with `null` and include coverage
metadata. Comparison functions may return `indeterminate`.

### ADR-005: RuneRating Does Not Persist History

RuneRating stores only the current canonical snapshot requested for an RSN.
Successful refreshes replace prior values. Historical data is fetched from the
provider that owns it when needed and is not persisted as RuneRating history.

### ADR-006: Current RSN Is The Player Identity

RuneRating identifies players by normalized current RSN. It does not attempt to
preserve account continuity across name changes.

### ADR-007: Sources Have Static Canonical Ownership

Every canonical field has one configured source owner. Hiscores owns every
metric it shares with another provider. Non-owner and unknown values are not
persisted.

### ADR-008: Refreshes Are Rare And Configurable

Convex stores refresh policy in database configuration. The initial policy
permits at most one successful snapshot refresh per normalized RSN per hour.

### ADR-009: Rich Categories Are Granular And Searchable

Large rich categories use current, indexed canonical item rows so users can
search and compare a specific collection item, quest, diary tier, or combat
achievement task. Search resolves through a canonical definition catalog;
absence from a player's rows means false only when the category snapshot is
complete.
