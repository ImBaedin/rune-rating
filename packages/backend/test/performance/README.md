# Achievement bandwidth regression benchmark

Run from the repository root:

```sh
ACHIEVEMENT_BENCHMARK_OUTPUT=packages/backend/test/performance/results.json \
  bun test packages/backend/test/achievementPerformance.test.ts
```

`baseline/` freezes the implementation immediately before the second optimization
pass (after refresh rebuilds were coalesced). Imports were redirected so it can
run alongside the new implementation. Do not refactor these frozen fixtures to
use the new readers, writers, or cache guard: that would invalidate the comparison.
The evaluator and catalog are shared so both implementations must produce the
same current state vector and complete evidence output.

The synthetic account uses the checked-in canonical catalog: 203 quests, 48 diary
tiers, 655 combat tasks, 124 collection pages, and 1,926 collection item rows
(including items occurring on multiple pages), plus 24 skills and 111 activities.
Each implementation gets an independent Convex test database with equivalent
snapshots. Measurements are taken after its initial cache is built.

`measure.ts` wraps the database API and counts documents returned by indexed
queries and gets. Read bytes are UTF-8 JSON serialization of those full documents.
It also counts application write calls and their argument bytes. Empty lookups,
index scans, replication, protocol overhead, cache hits inside Convex, and actual
billed bytes are not measured. Query runs represent an uncached evaluation, not
every render, page view, or subscription notification. No production data or
external APIs are used.

The tests assert equal outputs, zero bulk item/snapshot reads for unchanged
rebuilds, zero prior-evidence reads for warm rebuilds, lower byte totals, lazy
fallback for preexisting players, and no player writes for enrollment/cooldown.
Writer regression tests additionally cover collection membership changes with
unchanged totals, invalid combat data, and late/stale collection commits.
Numeric Hiscores rank changes do not invalidate achievements; becoming unranked
does. Catalog changes and legacy caches still rebuild.

`results.json` is an example recorded run, not a production forecast. The report
in `../../ACHIEVEMENT_PERFORMANCE.md` explains its scope and tradeoffs.
