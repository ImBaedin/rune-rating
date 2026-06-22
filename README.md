# RuneRating

RuneRating is a desktop-first analytics dashboard for comparing two Old School
RuneScape players across OSRS hiscores, Wise Old Man, and RuneProfile.

The product is intentionally serious, neutral, and information-dense. It is not
an OSRS-themed fan interface and has no paid tier. The first release should make
data completeness and freshness obvious, compare only like-for-like metrics,
and remain useful when one or more external sources are unavailable.

## Status

This repository contains the working RuneRating web app, Convex backend,
domain model, and source SDK packages. The current focus is launch hardening:
route validation, provider refresh behavior, accessibility polish, and keeping
the documented data ownership rules intact.

## Architecture At A Glance

```text
Browser / TanStack Start
        |
        | reactive queries + refresh requests
        v
Convex public query/mutation API
        |
        | schedules cache-aware internal actions
        v
Source SDKs -> external APIs
        |
        | validated source DTOs
        v
Convex normalization + snapshot storage
        |
        v
Canonical profiles, time series, and comparisons
```

Convex is the system of record and reactive API. TanStack Start owns routing,
SSR, and presentation. External source packages are thin transport clients;
they do not own caching, comparison logic, or canonical models.

Read [docs/architecture.md](docs/architecture.md) for the complete design.

## Workspace

| Path | Responsibility |
| --- | --- |
| `apps/web` | TanStack Start dashboard and route composition |
| `packages/backend` | Convex schema, functions, normalization, jobs, and policy |
| `packages/domain` | Source-independent canonical types and comparison semantics |
| `packages/ui` | Manually styled Base UI primitives and dashboard components |
| `packages/sdk-hiscores` | OSRS hiscores transport and response parsing |
| `packages/sdk-wise-old-man` | Wise Old Man transport and response parsing |
| `packages/sdk-runeprofile` | RuneProfile transport and response parsing |
| `packages/config-typescript` | Shared TypeScript configuration |

## Commands

```bash
bun install
bun run dev
bun run build
bun run typecheck
bun run lint
bun run test
```

`bun run dev` starts the workspace development processes. For a focused web UI
session, run `bun --cwd apps/web dev`; for backend work, run
`bun --cwd packages/backend dev` after configuring the Convex deployment
environment.

## Key Decisions

- Store only current canonical snapshots, not RuneRating history or raw source payloads.
- Treat normalized current RSN as identity and enforce a configurable hourly refresh cooldown.
- Use Hiscores as the authority for every shared metric.
- Compare only mutually available data. Never silently treat missing data as zero.
- Return freshness and availability metadata beside every source-dependent view.
- Serve cached data immediately, then refresh stale data in the background.
- Keep source clients thin and put normalization and retry policy in Convex.
- Use Base UI for accessible behavior and bespoke CSS for the visual system.
