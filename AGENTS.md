# Repository Guidance

- Use Bun for package management and scripts.
- Keep source-specific response shapes inside their SDK package. Only canonical RuneRating models may cross into the web app.
- Keep external API credentials and fetch logic in Convex actions; never expose them to the browser.
- Add package-specific discoveries to the nearest package README or `AGENTS.md` rather than the repository root.

## Confirmed Data Policy

- Player identity is the normalized current RSN; do not model account continuity across name changes.
- Store only current canonical snapshots. Successful refreshes replace the previous snapshot; do not retain RuneRating history, raw payloads, or source-observation archives.
- External providers own historical data. Fetch provider history when needed without persisting it as RuneRating history.
- Cache transformed canonical Wise Old Man overview data for up to one hour to serve timelines and gains without repeatedly calling the provider; do not store raw WOM responses or treat the cache as a RuneRating history archive.
- Hiscores is authoritative for every metric it shares with another source.
- Rich categories must support granular lookup, including querying a specific collection-log item for both players.
- Search granular data through a canonical definition catalog; absence from a player's current rows means false only when that category snapshot is complete.
- Enforce a configurable refresh cooldown in Convex; the initial target is at most one successful snapshot refresh per player per hour.
- Start implementation with official OSRS hiscores, then add other providers. Assume no provider API keys initially.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
