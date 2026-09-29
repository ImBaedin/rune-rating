# Achievement performance: measured second-pass savings

These comparisons start **after** the earlier three-to-one rebuild coalescing.
They measure additional savings from content fingerprints, compact freshness
metadata, evidence chunk fingerprints, one atlas subscription, and read-only
player enrollment/cooldown lookups.

| Workload (warm cache) | Documents read, before → after | Read bytes, before → after | Reduction |
| --- | ---: | ---: | ---: |
| Unchanged achievement rebuild | 3,001 → 3 | 1,805,096 → 3,146 | 99.8% |
| One skill changed: achievement rebuild | 3,001 → 2,968 | 1,805,097 → 1,366,928 | 24.3% |
| Atlas progress + profile query | 24 → 11 | 33,250 → 5,573 | 83.2% |

The same fixture's enrollment + cooldown player lookups went from two player
write calls to zero. The atlas uses one subscription instead of two, retaining
all profile states needed for auto-refresh, including Wise Old Man.

## What to expect

- Inactive players and unchanged relevant data: nearly all **rebuild** read
  bandwidth and fact evaluation are eliminated after metadata is populated.
  Freshness timestamps still advance. Numeric Hiscores rank movement alone is
  ignored, but score/XP/level changes and becoming unranked are relevant.
- Changed players: all canonical inputs are still read and evaluated. Avoiding
  the previous evidence scan saved about 24% of rebuild read bytes here. Only
  chunks with different content or catalog versions are rewritten.
- Atlas queries: metadata replaces full skill/activity snapshot reads, and the
  combined response reuses player/state reads. This saved about 83% of read bytes
  per uncached query evaluation in this fixture. Browser response sizes remain
  similar; this is principally a database-read saving.
- Selected-node checks: the quest-only fixture retained its original read cost;
  the skill-dependent fixture used about 24% fewer read bytes. Small summaries
  are read directly to avoid making narrow detail queries more expensive.
- There is no expected provider HTTP payload reduction from this second pass.

## Costs and limits

The three source-completion metadata updates added 2,982 read bytes and
2,742 write argument bytes in this run
(three reads and three writes). Metadata is maintained for refreshed players,
including those who have not enrolled in achievements. The evidence index is
about 4 KB per evaluated player and is separate from the frequently read progress
record. Source metadata is about 1 KB per player. Existing records need no bulk
backfill: missing source metadata falls back to live snapshots; the evidence
index is populated on the next calculation. Cold builds have additional hashing
and metadata overhead and do not receive the warm-cache savings above.

The shared canonical-item synchronization still read 1,283,792 bytes before
rebuilding. Including **that step**, the unchanged rebuild, and the added metadata
reads yields a measured subtotal reduction of **58.2%**, rather than 99.8%.
That subtotal still excludes snapshot persistence, rating calculations, refresh
orchestration, provider queue work, and unrelated queries. It is not a whole-app
or whole-refresh billing forecast. Highly active players will see smaller gains
than inactive players.

Measurement: UTF-8 JSON bytes of documents returned through an instrumented
Convex test database. This excludes indexes, replication, transport overhead,
Convex query-cache effects, and subscription fan-out. Write metrics count calls
and serialized arguments, not billed writes. Synthetic inputs use the canonical
catalog; no production usage was sampled. Exact byte counts vary slightly with
IDs and timestamps. No wall-clock CPU speedup is claimed.

See [the reproducible benchmark](test/performance/README.md) and
[recorded results](test/performance/results.json). Production savings should be
validated using Convex read-bandwidth metrics and request mix after deployment.
