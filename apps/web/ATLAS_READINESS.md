# Achievement atlas readiness review

Reviewed September 28, 2026 (America/Chicago), on the local `AccountAchievments` working tree. This includes the uncommitted atlas implementation. The original review was read-only; the follow-up below records the requested fixes.

**Current recommendation: resolve the outstanding broad browser-suite failures before public launch.** Quest readiness evaluation and partial-source freshness reporting have now been fixed as described below. Original findings and earlier proposals remain historical evidence.

## Follow-up: evaluate prerequisites and show source data in milestone details

The user chose to keep `Available` and fix its evaluation. The domain compiler now
adds 63 verified canonical quest prerequisite sets to 88 quest-backed milestones,
alongside their existing required completion links. These include skill levels,
quest points and prerequisites outside the visible graph. Completion is unchanged.
Missing facts, potentially usable temporary boosts and unreported unlocks remain
unknown, with the reason shown in the selected milestone's prerequisite check.
Access milestones retain their quest-completion gate, so being eligible to attempt
Song of the Elves does not mark Prifddinas access available.

`questPrerequisites.json` records the Wiki source and verification metadata for
each set. This covers account prerequisites, not consumable supplies or ability to
win an encounter. The eight RFD subquest nodes remain individually untracked until
overall RFD completion confirms them. Non-quest nodes retain their authored graph
requirements; display-only diary/task prose was not silently made executable.

The user selected **milestone details**, not About, for source freshness. The
selected-node query now supplies only the sources used by its completion and
readiness checks. The panel shows provider, retrieval timestamp and current,
out-of-date, refreshing, failed or unavailable status. Problems expand that section
automatically. Collection-item freshness uses its independent detail timestamp
and queue job, not the summary timestamp. Overall stale/refreshing flags now
include all contributing categories. Saved progress is retained during failures.

The two permanently untracked milestones discussed in item 3 are **Perfected
quetzal whistle (i)** and **Hooded Slayer helmet**. Their unlock/assembly state is
not reported by the current providers. At the user’s request, both
were removed from the catalog, requirements, layout and compiled rules, along
with their unused icons. The atlas now contains **1,064 milestones**. Earlier
proposals below to retain these as browsable goals are superseded.

Item 4 refers to the pre-existing **93-test comparison/leaderboard browser suite**,
which finished with 70 passes and 23 failures. Twelve failed assertions target the
obsolete source-health or skip-link controls; one expects the former mobile
header behavior. The remaining ten involve heatmap keyboard interaction (three),
efficiency radio selection (three), leaderboard validation (two), WebKit scrolling
(one), and a WebKit navigation interruption (one). This is not evidence of 23 atlas
bugs. The broad suite has not been repaired or rerun in this follow-up.

The navigation/share-link/legend/full-search proposals from item 5 are **excluded
at the user's request**.

Regression coverage now includes real Song of the Elves, Dragon Slayer II,
Monkey Madness II, Lost City and fairy-ring conditions, retained access gates,
relevant-source traversal, partial provider failures and collection-detail jobs.
Desktop Chromium and 375×667 Chromium/WebKit checks confirmed the live prerequisite
and source sections with no horizontal overflow. Source retrieval time does not establish
the player's latest in-game plugin sync time.

After removing the two unsupported milestones: **151 unit tests passed**, all six package typechecks
passed, production build passed, and lint passed with the existing 124 warnings.
The compiled rule version is `034267d6b40a5706` (1,064 milestones).
The obsolete test for those two unreported unlocks was removed; RFD inference
coverage remains. Removal checks are recorded in `output/playwright/removal-*.log`. React Doctor reported no errors
in the changed UI; its local-time warning concerns data rendered only after a
client-side query. CodeRabbit's two minor compiler findings were fixed: reject
unknown combat tiers and correctly convert file URLs when paths contain spaces.

Evidence: [desktop sources](../../output/playwright/evaluation-sources.png),
[mobile details](../../output/playwright/evaluation-phone.png),
[tests](../../output/playwright/evaluation-test.log),
[types](../../output/playwright/evaluation-typecheck.log),
[lint](../../output/playwright/evaluation-lint.log),
[build](../../output/playwright/evaluation-build.log).

## Earlier follow-up fixes and proposed decisions

Implemented after the review:

- Replaced the four broken ring descriptions and the cape-pouch description. Catalog validation now rejects unresolved placeholders.
- Normalized milestone-search apostrophes, dashes, case and whitespace; added real-catalog regression coverage and exact-name ranking coverage. The result count now explicitly says when only eight matches are shown.
- Made search results scroll within the available visual viewport, including resizing as the header or viewport changes.
- Moved focus to the details close button after selection. Escape closes the panel and restores focus to a stable trigger, including after search results unmount.
- Added visible fairy-ring and Zulrah quest-stage caveats. About now explains selected prerequisites, logged acquisition versus ownership, and RuneProfile synchronization.
- Disabled refresh during the known cooldown, displayed the next eligible local time, guarded same-account submissions regardless of RSN casing, and scheduled a render at cooldown expiry.
- Cleared the five lint errors uncovered across the atlas import list, shared SVG title, atlas-test formatting and extraction-script formatting/type annotation. Updated obsolete README statements that still described canonical bindings as future work.

Follow-up verification: **143 unit tests passed**, typechecking passed, the production web build passed, and repository lint passed with 124 warnings and one informational diagnostic. The compiled catalog still contains 1,066 bindings at version `eb6098851e018a4b`; completion semantics were unchanged. Chromium and WebKit at 375×667 both place the search popup bottom at y=655 and allow scrolling to its last result. Selection/Escape/focus return passed in both engines. Desktop Chromium was also checked. Physical software keyboards remain untested.

React Doctor found no errors in the three changed React files. It flagged the existing large page component and local-time formatting in the cooldown. The latter only renders after client-side Convex queries supply a future cooldown; the server's initial query result is undefined, so that branch does not format a server-local time. CodeRabbit re-reviewed 27 atlas files and suggested synchronizing the account input on RSN changes; the existing caller already keys the component by `account.rsn`, so no extra effect was added.

The broad browser suite was **not rerun** in this follow-up. Its original 70 passes / 23 failures remain an unresolved release gate, and dedicated atlas browser regression coverage is still recommended.

Suggested next changes, in priority order:

1. **Use a conservative readiness label for launch.** Rename `Available` to `Next on this path` and explain that this means selected graph prerequisites are satisfied. Keep completion rules unchanged. A later full readiness model should evaluate all canonical skill, quest-point, quest and other prerequisites separately from completion, using unknown when necessary evidence is missing.
2. **Expose category-level freshness.** Aggregate the actual dependencies of the cached progress vector, including Hiscores skills/activities, quests, diaries, combat achievements and collection-detail jobs. Retain saved results while clearly marking failed/stale categories. Add backend cases for partial failures and in-flight detail jobs before changing the response contract.
3. **Separate permanently unsupported goals from unknown data.** Show two untracked milestones separately and use 1,064 trackable milestones as the progress denominator, retaining all 1,066 as browsable goals. Reserve `Unknown` for missing or incomplete provider evidence.
4. **Repair the browser release gate.** Update obsolete shared-header selectors, then investigate the remaining assertions individually. Add atlas search, overflow, keyboard and cooldown scenarios so these fixes stay covered.
5. **Improve navigation and launch discoverability.** Add a validated milestone URL parameter and copy-link action; add a full-results view and category/status filters; add a compact legend and category-overflow affordance. Decide whether to remove `noindex` for the public explorer and keep player URLs separately controlled.
6. **Finish content and performance sign-off.** Have the content owner verify the remaining quest/diary requirements against current sources, attach verification dates near authored definitions, and measure a production cold load on a real phone before choosing bundle splits.

Follow-up evidence: [mobile search](../../output/playwright/fixes-mobile-search.png), [desktop](../../output/playwright/fixes-desktop.png), [unit tests](../../output/playwright/fixes-unit.log), [typecheck](../../output/playwright/fixes-typecheck.log), [lint](../../output/playwright/fixes-lint.log), [production build](../../output/playwright/fixes-build.log), [React Doctor](../../output/playwright/fixes-react-doctor-atlas.log), [CodeRabbit](../../output/playwright/fixes-coderabbit.jsonl).

## Original confirmed findings

### 1. Partial provider failures are hidden by the freshness response — P2

[Backend progress query](../../packages/backend/convex/achievements.ts#L104) bases `ready`, `refreshing`, and `stale` on the RuneProfile **quests** state. Skills, kill counts, combat achievements, and the separately queued collection detail fetch do not contribute to that decision.

A temporary, isolated Convex-test probe seeded fresh quests, failed Hiscores skills/activities, failed combat achievements, and a valid cached progress vector. The response was `{ availability: "ready", stale: false, refreshing: false }`. The frontend's warning depends on that `stale` flag; its fallback timer uses the overall latest snapshot timestamp, which a successful RuneProfile refresh can advance even when Hiscores fails.

**Fix:** derive freshness from every source used by the cached result and expose collection-detail queue/failure state. Keep saved progress, but identify which categories are stale or unavailable. Verify fresh quests + failed Hiscores, valid quest summary + invalid combat detail, and failed collection-detail refresh.

### 2. “Available” overstates quest readiness — P2

[Evaluator](../../packages/domain/src/achievements/evaluator.ts#L279), [Dragon Slayer II definition](src/features/achievements/atlasCatalog.json#L483), and [visible status labels](src/features/achievements/atlasPreview.ts#L105).

The evaluator treats authored required links as the complete readiness test. Dragon Slayer II has only Legends’ Quest as a required link. A probe with Legends completed and Dragon Slayer II not started returns `Available`, even with no evidence for its required 200 quest points, 75 Magic, or 70 Smithing. Those are real requirements in the [Wiki quest details](https://oldschool.runescape.wiki/w/Dragon_Slayer_II). Monkey Madness II similarly checks only Monkey Madness I and 69 Slayer. Only seven of the 96 quest-rule nodes have additional requirement panels; some of those seven are unlocks, not quests.

The README correctly calls this a curated graph, but the UI does not explain that qualification. “Follow this path” and “Requirement” reinforce the impression that the path is sufficient.

**Fix:** either evaluate the full prerequisite set for readiness, or rename `Available` to a term such as `Incomplete` / `Next on this path` and clearly disclose that the graph contains selected prerequisites. Completion can continue to use the canonical quest record. Do not silently turn display-only requirements into completion tests.

### 3. Five descriptions contain broken generated copy — P2

In [atlasCatalog.json](src/features/achievements/atlasCatalog.json#L10493):

| Milestone | Current description | Location |
| --- | --- | --- |
| Berserker ring | “Train every skill to at least level undefined.” | 10493 |
| Warrior ring | Same | 10576 |
| Archers ring | Same | 10659 |
| Seers ring | Same | 10742 |
| Cape pouch | “Reach Collection milestone to unlock the skillcape.” | 20878 |

The Berserker ring text was reproduced with a live account in the browser. [Screenshot](../../output/playwright/readiness-berserker-copy.png).

**Fix:** replace each with item-specific acquisition/use copy. Add a catalog validation check for unresolved template values and a human copy pass for reward types. CodeRabbit independently identified these two groups of errors; its third suggestion concerned hypothetical empty-section validation and is not a current release defect.

### 4. Mobile search results are clipped and cannot be scrolled — P2

[Search popup styles](src/pages/AchievementsPage.css#L1316), [clipping container](src/pages/AchievementsPage.css#L21).

At 375×667, with a live account, search for `diary`. The popup starts at y=317 and ends at y=778.5. The seventh and eighth result buttons end at y=689 and y=741. The document remains 667px tall, the atlas uses `overflow: clip`, and the popup uses `overflow-y: visible`. The last results and match count cannot be reached by scrolling the page. An onscreen keyboard reduces the available space further, though a physical keyboard/device was not tested.

[Screenshot](../../output/playwright/readiness-mobile-search.png).

**Fix:** constrain the popup to the available visual viewport and make its result list scrollable. Test small phones, landscape, browser zoom, and an open software keyboard.

### 5. Selecting a search result loses focus and breaks Escape — P2

[Selection handler](src/pages/AchievementsPage.tsx#L157), [Escape handler](src/pages/AchievementsPage.tsx#L243), [detail panel](src/pages/AchievementsPage.tsx#L502).

Selecting a result clears search and unmounts the focused result button. Focus falls to `BODY`; no focus moves into the details. Pressing Escape at that point leaves the panel open because the handler is attached to `<main>`. This was reproduced in Chromium; mobile WebKit also loses focus to `BODY` after selection. The About dialog explicitly promises Escape will close details.

**Fix:** focus the detail heading or close button after selection and restore focus to a stable trigger when closing. Ensure Escape works whenever details are open. For the mobile overlay, choose explicit nonmodal or modal focus behavior and prevent focus from disappearing behind it.

### 6. Ordinary typed apostrophes make existing milestones disappear from search — P2

[Search matching](src/pages/AchievementsPage.tsx#L93).

`Mourning's` returns “No milestones found”; `Mourning’s` returns both Mourning’s End quests. Search only lowercases and performs an exact substring match, while the catalog mixes straight and typographic apostrophes. This is easy to hit with a normal desktop keyboard.

**Fix:** normalize apostrophes, Unicode punctuation, and whitespace on both input and indexed text. Add common abbreviations where useful (RFD, DS2, MM2, etc.). The existing `atlasSearch.test.ts` covers RSN route validation, not milestone text matching.

### 7. Quest-stage approximations are presented without their caveats — P2

[Fairy rings](src/features/achievements/atlasCatalog.json#L902), [Zulrah unlocked](src/features/achievements/atlasCatalog.json#L20095).

Fairy rings evaluates a started Fairytale II as complete. The [actual unlock](https://oldschool.runescape.wiki/w/Fairy_rings) also requires the Fairy Godfather’s permission. The description mentions permission, but nothing explains that the green completion badge cannot verify it. Zulrah uses full Regicide completion, whereas [access is possible after reaching Port Tyras and the relevant sacrifice dialogue](https://oldschool.runescape.wiki/w/Zulrah). Its description simply says to complete Regicide.

The README says exact-stage limitations appear in the details, but there are **no `heuristic` values in the catalog**, so the existing heuristic rendering branch never supplies that explanation.

**Fix:** preserve the intended conservative/approximate rules if desired, but visibly label them as estimates or quest-route checkpoints. For Zulrah, explain that earlier access may already exist. For fairy rings, explain that started quest status does not verify permission. Reconcile the README with the actual UI.

### 8. Refresh during cooldown looks like a broken button — P2

[Refresh button](src/features/achievements/AtlasAccountLookup.tsx#L34), [load action](../../packages/backend/convex/achievements.ts#L64), [status message](src/features/achievements/useAtlasAccount.ts#L113).

The server enforces cooldown, but the UI only disables refresh while busy. The query returns `refreshAllowedAt`; the UI does not display or use it. Clicking refresh on IronBaedin during the cooldown returned to exactly the same count and timestamp, with the button enabled and no explanation. `load` discards the refresh mutation's result.

**Fix:** show when the next refresh is allowed and acknowledge a cooldown response. Make clear that RuneRating refreshes its saved provider data; users may also need to sync the RuneProfile plugin.

### 9. Release verification is not green — release gate

- `bun run lint` fails. Targeted validation identifies an import-order error in [atlasEquipmentIcons.ts](src/features/achievements/atlasEquipmentIcons.ts#L1) and a missing SVG title diagnostic in the shared brand asset. The brand is used decoratively inside an already named link, so resolve that diagnostic with the intended accessibility semantics rather than adding redundant spoken text blindly. The web lint step also reports 108 warnings. Root Biome checks do not run after the Turbo lint failure.
- The existing browser suite finished with **70 passed and 23 failed** across Chromium, mobile Chromium, and WebKit. These failures are outside the atlas. Confirmed stale selectors include `Data source health` versus the current `Data sources: 3 of 3 live` button, and `Skip to comparison` versus `Skip to content`. Other failures need individual triage; they are not all proven to be test-only problems. [Full browser log](../../output/playwright/readiness-browser.log).
- No test under `tests/browser` visits `/achievements`; the `combat-achievements` coverage there is the comparison page. Atlas unit tests do not replace browser coverage for search, focus, popup overflow, and live state transitions.

**Fix:** clear the lint errors, update obsolete selectors, investigate remaining failures, and add focused atlas browser coverage for the reproduced defects. Do not treat the current suite as a release sign-off.

## Product improvements and missing information

These are separate from the reproduced defects above.

1. **Make a selected milestone shareable.** [Route search validation](src/features/achievements/atlasSearch.ts#L3) preserves only `rsn`. Category, selection, search, and followed path are local state. Reloading a selected equipment milestone returns to Quests with the details closed. Preserve at least a validated `milestone` parameter and derive its section; add a copy-link action. Full viewport serialization is optional.
2. **Distinguish unsupported milestones from temporarily missing data.** Perfected quetzal whistle (i) and Hooded Slayer helmet are unconditional `untracked` rules. They can never complete with the current providers, yet the headline denominator includes all 1,066 milestones. Show “Not tracked” separately and report a trackable denominator or an explicit unsupported count. A user should not keep refreshing in pursuit of an impossible 100%.
3. **Clarify the scope of equipment completion.** Most equipment milestones correctly test logged acquisition/components rather than ownership, assembly, or consumed unlocks. Put that explanation in About and use consistent subtitles. Similarly, static subtitles such as “Quest completed” and “Collection page complete” appear even on incomplete live milestones; imperative wording would avoid competing with the real status badge.
4. **Add a short status/edge legend.** Explain complete, incomplete/available, locked, unknown, solid requirements, dashed suggested progression, and offscreen connections. Currently the details explain relationships, but the canvas and About provide no compact legend.
5. **Make category overflow discoverable.** At 1200px the Collections and Account tabs are outside the visible strip; at phone sizes only a few categories are visible. Horizontal scrolling works, but the scrollbar is hidden. Add an edge fade, scroll affordance, or a compact all-categories menu, and keep the active category visible after a global-search jump.
6. **Provide a way to reach all search matches.** The popup displays eight buttons but announces the full matching count. Add “Show all” or a scrollable, keyboard-accessible full result list, ideally with category/status filters. At this catalog size, filters for incomplete and unknown milestones would be useful.
7. **Make RuneProfile setup actionable.** Link directly to the provider/plugin setup from the unavailable state; distinguish not found/private profile, provider outage, and unsupported data. The current message combines not-found and not-connected into one requirement for a public RuneProfile.
8. **Decide launch indexing and sharing metadata.** [The route](src/routes/achievements.tsx#L17) still emits `robots=noindex` and has no atlas-specific canonical or social-card metadata. Keep noindex if this is intentionally a private preview; otherwise enable indexing for the public explorer and decide separately how player URLs should behave.
9. **Measure cold-load performance on a real phone.** The production atlas route chunk is 1,251.47kB (359.72kB gzip), before shared JS. The background map is another 994.02kB. The build succeeds, but this warrants a slow-network/CPU check and potentially splitting nonvisible icon/catalog data. Local dev responsiveness is not a production performance measurement.
10. **Keep content maintenance explicit.** Definitions are compiled and versioned, which is useful, but source verification dates live mainly in prose. Track verification provenance for changing recipes, diary requirements, and new content near their authoring data. Reject unresolved placeholders and validate that every layout section has placements. Clean contradictory README statements that still call canonical bindings future work or say no account integration exists.

## Verification evidence and limits

| Check | Result |
| --- | --- |
| `bun run test` | 141 tests passed across six packages; Turbo cache hits on the recorded repeat run |
| `bun run typecheck` | Passed across six packages |
| `bun run build:web` | Passed |
| Compiled catalog `--check` | Passed: 1,066 bindings, version `eb6098851e018a4b` |
| `bun run lint` | Failed as described above |
| CodeRabbit | Reviewed 25 atlas feature files; three suggestions, two confirmed content defects/groups |
| Isolated backend freshness probe | Reproduced hidden partial-source failure |
| Desktop Chromium | Sample atlas, live IronBaedin lookup, search/navigation, details, reload, cooldown refresh, focus/Escape inspected |
| Small-screen Chromium | 390×844 and 375×667 inspected; clipped search reproduced |
| Mobile WebKit | 402×681 emulation loaded live account and Barrows item-level detail successfully; focus loss reproduced |
| Broad browser suite | 70 passed, 23 failed in 7.6 minutes; failures need triage before release |

Screenshots: [desktop](../../output/playwright/readiness-desktop.png), [phone details](../../output/playwright/readiness-mobile-details.png), [clipped results](../../output/playwright/readiness-mobile-search.png), [bad ring description](../../output/playwright/readiness-berserker-copy.png), [WebKit explorer](../../output/playwright/readiness-webkit-mobile.png), [WebKit collection detail](../../output/playwright/readiness-webkit-log.png).

Logs: [browser suite](../../output/playwright/readiness-browser.log), [web lint errors](../../output/playwright/readiness-lint.log), [CodeRabbit](../../output/playwright/readiness-coderabbit.jsonl).

Source cross-checks included Dragon Slayer II requirements, fairy-ring and Zulrah access, selected Herblore levels, Confliction gauntlet requirements, and selected diary/storage content. This was **not an independent line-by-line verification of all 1,066 milestones against current game data**. Wiki access was partly limited to indexed results. Recent content and all 48 diary requirement lists still warrant an authoritative content-owner pass before claiming exhaustive accuracy. Physical iOS/Android devices, software-keyboard behavior, production deployment, slow-network performance, and a complete assistive-technology audit were not verified.

The review used the [code-review skill](/Users/baedin/.agents/skills/code-review/SKILL.md), [Playwright skill](/Users/baedin/.codex/skills/playwright/SKILL.md), and [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
