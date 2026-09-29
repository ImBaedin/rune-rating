# `@rune-rating/domain`

Source-independent RuneRating vocabulary shared by the backend and web app.

## Owns

- Canonical metric keys and categories.
- Read-model TypeScript types.
- Source availability and freshness vocabulary.
- Null-aware comparison result types.
- Pure comparison and formatting rules that are valid in any runtime.

## Does Not Own

- Convex document IDs or database access.
- External source DTOs.
- HTTP clients, caching, or retries.
- React components.

The domain package should remain small and dependency-light. Runtime validation
for persisted data belongs in the Convex backend; source validation belongs in
the relevant SDK.


## Achievement evaluation

The atlas authoring source remains `apps/web/src/features/achievements/atlasCatalog.json`.
Layout, icons, prose, and reference-only links never participate in completion.
Run `bun packages/domain/scripts/compile-achievements.ts` from the repository root
when editing rules, canonical definitions, or evaluator logic. `--check` verifies
that the checked-in bindings are current. The web and backend share a catalog
version and ordered node count; an old client refuses a mismatched state vector.
After compiling catalog changes, keep `bun run dev` running for the backend or
run `bunx convex dev --once` from `packages/backend` to sync the development
deployment. Reloading the web app alone cannot update the backend catalog. A
version mismatch makes all personalized nodes unknown even when selected-node
evidence correctly reports completion. Verify a live account after catalog edits,
not only the sample atlas; matching versions let the existing rebuild flow update
cached progress without bypassing the provider refresh cooldown.

`achievements/definitions.json` is a canonical definition catalog (public game
facts, not player responses), adapted from RuneProfile's `packages/runescape`
quest, diary, combat-task, and collection-log catalogs. Its `revision` pins the
[upstream repository](https://github.com/ReinhardtR/runeprofile). The SDK's
`scripts/extract-achievement-definitions.ts` accepts a local directory containing
`tree.json` and the four source files named `quests.ts`, `diaries.ts`, `combat.ts`,
and `collection.ts`. It parses literal AST nodes without executing upstream code.
Regenerate compiled bindings after updating definitions. Definition updates are
an authoring operation; clients never fetch catalogs or assets from the wiki.

Bindings use stable quest, diary, item, and task identifiers. Collection-log
quantities are the maximum observation for an item across pages, never their
sum. Missing items are zero only after a complete detail snapshot. Hiscores owns
all shared metrics, including collection totals, skills, KC, and combat level
(derived from Hiscores skill levels); an unranked value remains unknown.

Atlas `requirements` rules combine evidence, such as a logged component plus
a skill level or completed quest. These differ from the display-only requirement
rows in the web package. Item rules may specify a canonical `key` to disambiguate
same-named items: the Medallion of the Deep needs all eight distinct fragments,
not eight observations of any one fragment. The compiler checks both key and name.
Explicit `untracked` rules keep unlocks absent from provider data unknown, including
the unlimited quetzal whistle and Absolutely Slayin’ purchase. Do not invent
collection-log definitions for non-log items.

The evaluator uses three-valued evidence. Known completion wins over prerequisite
readiness. Only `required` links gate availability; suggested progression and
panel-only reference lists do not. Counts can prove success from a lower bound,
but an unknown input cannot prove failure unless the known evidence already does.
The state vector uses `0` completed, `1` available, `2` locked, and `3` unknown.

Aggregate facts can carry named contributors for selected-node detail: completed
collection pages, unique pets and jars, level 99 skills, recorded bosses, and the
raid circuit. These lists use the same qualifying values as their counts, include
all confirmed contributors even beyond the milestone target, and are rebuilt from
current snapshots. They do not retain completion history or enlarge the compact
overview response. Collection contributor lists require complete detail data;
unranked Hiscores entries never contribute.

Selected-node breakdowns name the leading skills toward 200m XP, the next three
skills toward 99 (ordered by XP remaining), every known skill below a base-level
goal, and the next three incomplete collection pages (ordered by missing slots).
Completed 200m goals name the qualifying skills. Missing values and Overall never
become skill candidates; missing-slot counts do not estimate drop chance or time.

Individual collection-page evidence includes canonical item IDs, names, and logged
status only when the complete detail snapshot agrees with the page's slot totals.
Current page membership takes precedence over the definition catalog. Aggregate
greenlog lists carry links to available page milestones without embedding their
item lists; the web detail shows missing items first and collapses collected items.

RuneProfile does not expose individual RFD subquests. The overall quest's finished
state confirms their completion; otherwise they remain unknown. Started quests
retain the explicitly authored Fairy Rings heuristic. Equipment paths measure
logged acquisitions or assembled eligibility, never current bank ownership.

### Quest prerequisite readiness

`src/achievements/questPrerequisites.json` contains 63 canonical quest prerequisite
sets, verified against each linked OSRS Wiki quest-details section on September
29, 2026. Each entry records its source URL and raw-source hash. The compiler
attaches these rules to all 88 corresponding quest-backed atlas milestones and
rejects a quest without a verified entry. The eight RFD subquest milestones retain
their existing unknown-until-overall-completion behavior because RuneProfile does
not report their individual states.

Prerequisites affect readiness only. Completion remains authoritative even when
prerequisite data is missing. Known failed hard requirements lock a quest; missing
facts, unreported unlocks and a below-target boostable level stay unknown. Passing
all prerequisite checks makes an incomplete quest available. This checks account
prerequisites, not possession of consumable supplies or ability to win a fight.
Completed direct prerequisite quests establish their prerequisite chains without
requiring every intermediate row again.

The fairy-ring milestone checks the started Fairytale II checkpoint, so its
readiness rule intentionally omits the levels required to finish that quest.
Charter travel for Roving Elves and bypassable Ranged levels for Temple of Ikov
are not treated as mandatory level gates. Dragon Slayer II's Ancient Cavern
access, Bone Voyage Kudos and the Monkey Madness II balloon route remain unknown
when the provider cannot establish them. Starting Monkey Madness II proves its
required balloon route; full RFD completion proves the Awowogei subquest.

Edit the canonical rules after reviewing the linked source, update verification
metadata, then run `bun packages/domain/scripts/compile-achievements.ts`. Do not
infer executable conditions from display-only requirement prose. The compiled
version includes prerequisite rules and evaluator logic, so existing current
caches rebuild through the normal atlas load path. No history is retained.

`achievementSourceKeys` walks completion/readiness dependencies for selected-node
freshness. Collection rank uses Hiscores for obtained slots and RuneProfile for
catalog totals; item/page evidence uses the independent collection-detail fetch.

Achievement fact construction indexes collection items by page and observed combat
tasks by boss once per evaluation. Static page definitions and boss task membership
are indexed once per module, avoiding a full item/task scan for every page or boss.
These indexes preserve duplicate-item maximum quantities and incomplete-source
uncertainty; they are not player snapshot or history caches.
