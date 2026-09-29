# `@rune-rating/web`

TanStack Start application for RuneRating.

This is the production Scoreboard 2.1 frontend. The legacy application has been
removed after checking the replacement routes and interactions.

## Brand asset

`src/assets/brand/rune-rating.svg` is the shared mark for the public header,
comparison header, and SVG favicon. Its ivory (`#f4efe4`) corner pieces frame
amber (`#e7b957`) ascending pillars. Keep the transparent background and original
viewBox proportions; the linked wordmark supplies the accessible name, so header
images use empty alt text. Edit this one asset to update all three placements.

## Shared app header

Every page uses `AppHeader` for the brand, Compare / Rating / Leaderboard /
Achievements navigation, and motion toggle. Keep their order and dimensions
consistent across routes; `--app-header-height` controls the shared height and
sticky comparison-toolbar offset. Below 820px the navigation occupies a second
row. The motion toggle has a fixed column so its label cannot shift the links.

`ComparisonHeader` contains only player search, source health, refresh, and
comparison categories beneath the app header. The shared `InfoPopover` opens
the Sources pill on hover or click/tap and lists provider status and freshness.
Comparison passes the current primary player to the global Rating link and
uses `main-content` as the shared skip link's target.

## Release verification

See [the UI overhaul release checklist](PRE_SHIP_REVIEW.md) for the fixes,
verification evidence, and remaining deployment/device checks.

```sh
bun run typecheck
bun run test
bun run lint
bun run build
bunx playwright install chromium webkit
bun run test:browser
```

Run these commands in `apps/web`. The browser suite starts or reuses the dev
server on port 3000. Set `APP_BASE_URL` to test an already-running production
preview or deploy preview instead. It checks Chromium, a phone viewport with
touch emulation, and WebKit. Screenshots/traces are retained on failure.

Browser smoke tests use the existing GIM Wamuu / Starmie Iron sample comparison
and require a reachable Convex deployment. Use a development/test deployment:
normal page visits can request stale snapshot refreshes. Privacy transport tests
use a bundled harness with a local HTTP receiver; no analytics events
are sent to PostHog. Unit tests cover missing and failed provider states without
forcing an outage against the connected backend.

## Deployment configuration

Set `VITE_SITE_URL` to the public HTTPS origin (for example,
`https://runerating.app`), with no path or trailing slash. Canonical links and
social-card URLs use this build-time value. For a deploy preview, set it to that
preview's origin before building so sharing checks exercise the preview itself.

`VITE_CONVEX_URL` must point to the intended backend. The Netlify build command
injects it through `convex deploy --cmd-url-env-var-name VITE_CONVEX_URL`; local
development uses the value written by `bunx convex dev`. Keep preview deployments
on a development/test backend when running browser tests, which can refresh data.

Run hosted checks from this directory with
`APP_BASE_URL=https://your-preview.netlify.app bun run test:browser`.
On physical iOS and Android devices, open that preview and check rating-card
sharing (including cancellation), PNG download, player search, comparison tabs,
and dialog scrolling/closing. Browser emulation does not verify native share sheets.

## Responsibilities

- Own file-based routes, SSR, loading/error boundaries, and browser interaction.
- Subscribe directly to canonical Convex queries.
- Request refreshes through a narrow Convex mutation.
- Compose the current dashboard views from local feature components. Promote
  stable reusable pieces into `@rune-rating/ui` when that package is built out.
- Keep route search params shareable and validated.

## Route Structure

```text
src/routes/
  __root.tsx
  index.tsx
  rating.tsx
  leaderboard.tsx
  achievements.tsx
  og/rating/$rsn.tsx
  og/compare/$leftRsn/$rightRsn.tsx
  compare/$leftRsn/$rightRsn.tsx
  compare/$leftRsn/$rightRsn/
    index.tsx
    skills.tsx
    xp-timeline.tsx
    efficiency.tsx
    activity.tsx
    quests.tsx
    achievement-diaries.tsx
    combat-achievements.tsx
    bossing.tsx
    clues.tsx
    minigames.tsx
    collections.tsx
```

The parent comparison route owns the shell, category navigation, player headers, source
status, and refresh lifecycle. Child routes request only category-specific data
to keep reactive payloads bounded.

## Achievement atlas preview

The [September 28 readiness review](ATLAS_READINESS.md) records confirmed release
defects, browser evidence, verification results, and suggested improvements.
Quest-backed milestones now evaluate verified canonical prerequisites separately
from completion: skill levels, quest points, prerequisite quests and unreported
unlock conditions. The domain package owns the rules and their Wiki provenance.
Temporary boosts and unreported stages stay unknown when they cannot be proved.
Other milestone paths still use authored graph requirements. Fairy-ring and
Zulrah details explain the exact quest stages the providers cannot verify.
Selected milestone details include the prerequisite check and a Source data
section with only its relevant providers, timestamps and refresh status.
Milestone search normalizes apostrophes, dashes and whitespace, bounds its
scrollable results to the visual viewport, and restores focus after closing
details. Refresh cooldowns display the next eligible local time.

`/achievements` is a full-screen atlas with sample progress and account lookup.
The web app and backend share compiled achievement bindings from the domain package.

The atlas contains 1,064 authored milestones across Quests, Travel & Magic,
Combat Gear, Skilling Gear, Self-sufficiency, Diaries, Bossing, Collections, and Account.
These are curated paths, not an exhaustive quest prerequisite database.
All account types see the same milestones.

Skilling Gear has Fishing, Mining, Forestry, shared tool components/signets, tool
upgrades, Runecraft, Farming/Herblore, Construction/Smithing, Agility/Thieving,
Hunter/Fletching, and Firemaking/Prayer subsections. Its four pre-existing outfit
IDs moved out of Collections. Barrows sets moved into Combat Gear; Collections
now groups collection ranks, pets/jars/greenlogs, Treasure Trail unlocks, and
Barracuda Trial rewards into four separately navigable subsections. The six
Wintertodt, Tempoross, and Guardians of the Rift activity nodes were removed
from Collections. Tempoross gear references use the existing Bossing greenlog;
Guardians of the Rift gear references retain their Wiki destination. Existing
`equipment` and `combat` IDs remain stable; only their visible names changed.
The new section ID is `skilling-equipment`.

Collection ranks follow a three-by-three winding path: bronze → iron → steel,
then black → mithril → adamant from right to left, and rune → dragon → gilded
from left to right. Same-row progression edges connect facing side handles;
the row turns retain downward connections. This keeps all nine ranks balanced
across the section in three rows, with the larger gilded node as the endpoint.

Skilling sources were checked on September 26, 2026 against the Wiki's
[collection-log skilling guide](https://oldschool.runescape.wiki/w/Guide:Collection_Log_Based_Skilling),
[fish barrel](https://oldschool.runescape.wiki/w/Fish_barrel),
[Forestry basket](https://oldschool.runescape.wiki/w/Forestry_basket),
[crystal equipment](https://oldschool.runescape.wiki/w/Crystal_equipment), and
[Guardians of the Rift changes](https://oldschool.runescape.wiki/w/Update:Guardians_of_the_Rift_Changes_Out_Now!).
Individual nodes retain their own guide links. All definitions and named sprite
imports are bundled; these citations are authoring references, not runtime fetches.

Skilling completion semantics:
- Outfits and purchased rewards use logged item acquisitions, not bank ownership
  or inferred purchases. Graceful uses the Rooftop Agility log; spirit angler uses
  its logged upgraded pieces rather than inferring conversions from spirit flakes.
- Fish sack barrel, expert glove, Forestry basket and tool upgrades track key
  components. Ordinary materials, fees, charges and assembly are not evaluated.
  Forestry's harness requirements remain explicit in the detail panel.
- Crystal tool seeds and smouldering stones are single shared nodes with links
  from each tool's details. A component is not consumed or allocated by the atlas.
- Dragon pickaxe acquisition accepts either its intact or repairable Volcanic
  Mine entry; paying the repair fee is not inferred.
- The 85 Runecraft node is maximum colossal-pouch capacity, not creation or
  ownership. Creation starts at 25 Runecraft with 56 Crafting, the needle and
  existing pouches; those prerequisites are listed in details.


Authoring is split into independently editable files in `src/features/achievements/`:

- `atlasCatalog.json`: stable IDs, copy, completion rule, icon key, map anchor,
  Wiki reference and typed links (`required`, `progression`, `supports`).
  A link can set `display: "details"` to retain dependency/readiness semantics and
  navigation without rendering a graph edge, even within the same group.
- `atlasRequirements.json`: display-only skill/quest/task prerequisites for all 48
  diary tiers, the staffless fairy-ring reward and selected upgrades. Rows have a
  source guide and optional `milestoneId` navigation target. Diary skill rows link to an exact authored level
  when one exists; otherwise they open the guide, just like missing quest milestones.
  These informational navigation links are not completion tests. Diary records remain the
  completion authority. `AtlasRequirements.tsx` renders expandable panels.
- `atlasLayout.json`: section/path headings, vertical groups, each node's
  section/group/lane/local row, and
  `funnels` that declare parallel resources and their combined result. Change
  placement here without touching achievement identity or completion rules.
  Funnel inputs share a row; the result is centered below their horizontal bounds.
- `atlasDemo.json`: explicit sample completions, isolated from the definitions.
- `atlasData.ts`: types, map anchors, grid sizing and authoring validation.
- `atlasIcons.ts` / `atlasEquipmentIcons.ts` / `atlasSkillingIcons.ts` / `atlasRecentIcons.ts`: named imports of local OSRS sprites.
  Boss art uses the shared `bossIcons.ts` registry of bundled local portraits.
  `src/assets/bosses/sources.json` records the original Wiki image URLs.
- `atlasBossRoster.json`: authored encounter coverage index, including shared-page
  exclusions; the domain compiler resolves the authored rules to canonical bindings.
- `atlasPreview.ts`: view adapter and illustrative readiness from required links.
- `AtlasGraph.tsx`: React Flow canvas, styled custom nodes, handle-based edges,
  section navigation and viewport controls. Nodes are fixed, not user-editable.
- `atlasViewport.ts`: pure centering/alignment, visible-section and zoom-anchor calculations.
- `atlasNavigation.ts` / `AtlasJumpMenu.tsx`: category dropdowns beneath the main navigation tabs,
  listing each category’s overview, vertical groups and named paths. Destinations use stable option IDs and are built
  once from layout metadata; selecting one clears search/selection, preserves zoom,
  updates the active tab and navigates directly, including across sections.
- `atlasRouting.ts`: detect intervening cards before detouring vertical connections.

Rows increase downward; lanes increase rightward. Sections are laid out side by
side in a continuous canvas. Tab labels animate to a section; each adjacent chevron opens that
category’s subsection menu. Menus support keyboard navigation, touch and scrolling
through long lists, without subscribing to graph viewport changes. Global search jumps to an achievement. Combat Gear, Skilling Gear and Bossing
remain bounded to at most 1,900 canvas units wide while extending downward. A group defines its origin
`row`, occupied `rows`, heading, description and optional local path labels. Node
rows are relative to that group, so moving one group moves its entire layout.
Tinted header bands and generous gaps distinguish the groups. Same-group edges
are drawn; connections across groups or sections have an indicator and remain
navigable in the details.
RFD rescues form an independent four-column group with short names. Visible
connections branch from Cook’s Assistant to all eight rescues, then converge on
the eight-rescue aggregate. The aggregate and quest-point gate feed the finale
and barrows-glove eligibility, preserving the parallel nature of the subquests.
Prerequisites from other groups remain navigable in details.
Boss quest checkpoints and 15 quest-gated access milestones precede the combat
chapters. Full quest completion is used where exact intermediate stages are not
observable; the descriptions call out earlier access where applicable.
Solid edges are requirements; dashed edges are suggested progression or preparation.
The details label each relationship explicitly. A suggested edge never makes a
node unavailable. ALL/ANY composite rules distinguish requirements from alternatives.

Rules use semantic quest/item names and metric keys for authoring. The domain
compiler resolves them against the canonical definition catalog into the bindings
used for player evaluation; provider DTOs must not enter the web app. Missing player
rows must not count as false unless that category snapshot is complete. Hiscores
remains authoritative for shared metrics.

Specific authoring decisions:

- Gloves and skill/quest/diary capes check eligibility, without a purchase check.
  Fire/Champion cape log entries record their earned reward, not current ownership.
- Equipment paths check recorded components, not assembly or current inventory.
  The lance path uses spear + claw; spear-to-hasta conversion is not tracked.
- A Barrows set includes its weapon. Its connection to Morytania elite is preparation;
  a collection entry does not establish that the player performed the diary task.
- Fairy rings explicitly use Fairytale II started-or-finished as the approved
  heuristic. Its details explain that exact quest-stage progress is unavailable.
- Skill capability nodes use base levels. Boosts, stockpiles, purchases, consumed
  prayer scrolls, house furniture and exact quest stages are not evaluated.
- Gilded collection rank uses 90% of the current unique-entry total, rounded down
  to 25; other ranks have explicit thresholds. Staff ownership is not checked.
- First-KC rules are limited to the supported one-kill Hiscores cases (Zuk, Mimic).
  Existing boss paths start at 25; expanded paths use 100/500/1,000, without
  log/task inference. Shared logs use the combined page (e.g. Callisto and Artio),
  with separate mode-specific task categories where the Wiki supplies them.
- Dynamic catalog rules (all quests, boss tasks, collection pages, all skills) must
  use current canonical membership during evaluation, not frozen authored totals.
- Moon sets include armour and weapon. Armour sets use each logged piece; Torva
  checks damaged drops, not repairs. Hueycoatl checks hide, not unlogged crafted armour.
- Twinflame staff checks the two Royal Titans crowns (items 30631 and 30628).
  Its common battlestaff and 60 Magic wield requirement are detail-panel context;
  assembly and current ownership are not inferred. All three icons are bundled.
- The Blood Moon Rises lives at the end of the Myreque quest lane, with Sins of
  the Father and A Night at the Theatre feeding into it. Vampyrium access uses
  finished quest status; the existing Maggot King access node links back here.
  Skill requirements are detail-panel context. The quest's current requirements
  were checked against the [indexed wiki revision](https://osrsindex.com/wiki/the-blood-moon-rises?site=osrs_wiki)
  on September 26, 2026; the [Twinflame recipe](https://oldschool.runescape.wiki/w/Twinflame_staff)
  supplies the crown recipe.
- Zaryte and Soulreaper milestones explicitly track rare components; common
  materials and assembly are outside those checkpoints. Ring recipes include three
  chromium ingots, and zenyte bracelet capability requires 95 Crafting.
- Rancour, Rupture and Confliction are self-sufficient upgrade routes through the
  corresponding base jewellery route plus the logged rare component. They do not
  claim actual ownership of a crafted base or finished upgrade. Confliction also
  includes 70 Smithing; its consumed demon tears and the fang-etching actions for
  the other routes are explained in details without pretending to track consumption.

The expansion’s item names and boss category/page scopes were checked against the
[Collection log](https://oldschool.runescape.wiki/w/Collection_log) and
[Combat Achievement tasks by boss](https://oldschool.runescape.wiki/w/Combat_Achievements/Tasks_by_boss)
on September 26, 2026. Diary panel requirements were authored from each regional
Wiki overview, preserving started/partial quests, boost notes and guide links for
conditional methods. Recipe references live on individual definitions, including
[Necklace of rupture](https://oldschool.runescape.wiki/w/Necklace_of_rupture),
[Amulet of rancour](https://oldschool.runescape.wiki/w/Amulet_of_rancour), and
[Confliction gauntlets](https://oldschool.runescape.wiki/w/Confliction_gauntlets). This is
curated display content, not a stored provider snapshot or an ownership evaluator.

`bun test tests/atlas.test.ts` validates references, cycles, placement spacing,
downward progression, resource funnels, sample consistency and the agreed rule
semantics. `tests/atlasViewport.test.ts` covers section centering/left alignment at
current zoom and anchored Safari zoom. Relevant
Wiki references include [quest series](https://oldschool.runescape.wiki/w/List_of_quest_series),
[collection ranks](https://oldschool.runescape.wiki/w/Collection_log),
[Morytania diary](https://oldschool.runescape.wiki/w/Morytania_Diary), and
[onyx amulet crafting](https://oldschool.runescape.wiki/w/Onyx_amulet_%28u%29).

The map opens centered on Lumbridge Castle. Hover/focus previews a location,
clicking pins it, and Escape releases it. Leaving
a node or releasing a selection keeps the last viewed location. `AtlasCamera.tsx`
owns an interruptible 1.9-second flight: pan while pulling back, then zoom in during
the last 60% of travel. Each destination lands underneath the hovered/focused node's
icon, using its rendered position after graph pan and zoom. Re-entering a node
retargets the camera even if its location matches the previous destination. Reduced
motion snaps directly to the destination. The opening view renders at 1.45× map zoom
from the server onward; resolving the motion preference during hydration does not
start a camera flight without a node target.
Hovered/selected nodes land at 2.3×. Selecting the current preview preserves its
camera flight; selecting a new node directly pans/zooms without a pullback.
Statuses are Completed, Available, and Locked, shown on nodes and in their details
without a separate footer legend.
The viewport-sized canvas uses `@xyflow/react` with its base CSS loaded before the
atlas stylesheet. The custom node frames, status indicators, tooltips and detail
panel retain the app's existing styling. Invisible handles on the icon frames
supply actual edge endpoints, including for larger destination icons. Paired
resources use side handles to converge into the result's top handle. Long edges
take a side detour only if another card blocks the vertical route; empty rows and
neighboring supply funnels do not force a bend. Endpoints always come from React Flow.

React Flow owns the graph's single pan/zoom transform. Do not add separate CSS
scale/translate updates or a second gesture controller. Canvas zoom is 0.25–1.8;
the original 0.85 opening scale is shown as 100% in the controls. Wheel and two-finger
trackpad scrolling pan freely in both axes; trackpad pinch zooms around the cursor.
Touch pinch supports a moving midpoint and continuation with one finger.
`useAtlasSafariGesture.ts` is a narrow adapter for
Safari desktop `gesture*` events: it writes through React Flow's viewport API and
deduplicates wheel/touch streams, rather than maintaining another transform.

Section tabs preserve the current zoom, center sections that fit the padded canvas,
and left-align wider sections. This runs only on navigation, so zooming or dragging
does not trigger a competing recenter. Manual navigation updates the active tab and
path picker from the section beneath the viewport center, with the nearest section
used in gaps. Programmatic flights retain their destination tab throughout. This
updates the displayed category without issuing another navigation. The movement
callback only compares nine section bounds using a cached viewport width; a ref
guards state updates so they occur once per actual section crossing, inside a
transition. Filter sets are memoized and edge routing is precomputed once. React
Flow virtualizes nodes/edges with explicit handle geometry, including edges whose
source is currently offscreen. Search resolves the mounted icon when aiming the
map, including when motion is reduced. Search and related-node buttons navigate to
individual nodes. Viewport initialization, rather than the measurement of every
node, gates navigation because the catalog already supplies fixed positions and
sizes. Arrow keys pan, Shift increases the step, and Home/reset returns to the active
section at opening zoom. Hover previews are suppressed during gestures and section
flights, with a short settling interval before they resume.

The map camera stays outside React Flow. It still follows the rendered node icon,
retains its last location after hover ends, and has no graph-driven parallax.
Graph dragging, scrolling, and zooming never translate the background. A gesture
also freezes an active camera flight's focal point so it cannot chase a moving node;
the next deliberate node preview can start a new flight. Subtle cursor motion remains.
Global pause/reduced motion disables decorative movement and animated section transitions;
direct graph pan and zoom remain available. No account integration was added.

The local `src/assets/atlas/gielinor.webp` is a 3200 × 2267 optimized version of the
[OSRS Wiki world map](https://oldschool.runescape.wiki/w/File:Old_School_RuneScape_world_map.png),
retrieved September 26, 2026 (source image revision September 17, 2026).
The source is 9216 × 6528; the optimized asset is approximately 971 KiB.
The Wiki file page identifies it as Jagex copyrighted material under its
`Map license` / `Fair use` templates, linking the official world map. This is not a
claim that game imagery is covered by the Wiki's text license. Keep the visible
Jagex/Wiki attribution and source link when replacing the asset. The map asset is bundled locally, so displaying the background does not request
the Wiki. Boss thumbnails are also bundled locally through the shared image registry
(68 unique portraits, approximately 1.32 MiB). Graph definitions, requirements,
icons and map assets ship with the app; browsing the atlas makes no automatic
requests to the Wiki. Explicit source/guide links still open Wiki pages.

The atlas uses the existing Scoreboard font and color tokens. Quest, skill,
item, cape and collection staff sprites come from the existing `@dava96/osrs-icons`
dependency via `osrsIcons.ts` and `atlasIcons.ts`. Diary milestones and their tab use
the local [Achievement Diaries icon](https://oldschool.runescape.wiki/w/File:Achievement_Diaries_icon.png)
from the Wiki, retrieved September 26, 2026, instead of the quest sprite. The local
[necklace](https://oldschool.runescape.wiki/w/File:Necklace_of_rupture.png) and
[fang](https://oldschool.runescape.wiki/w/File:Elder_venator_fang.png) sprites also
come from the Wiki because the installed sprite package predates those items.
The local music-tab icon and resized Hunllef image
come from [Music.png](https://oldschool.runescape.wiki/w/File:Music.png) and
[Crystalline Hunllef.png](https://oldschool.runescape.wiki/w/File:Crystalline_Hunllef.png)
on the OSRS Wiki; these are also Jagex game artwork.

## Guardrails

- Do not import source SDKs or source DTOs.
- Do not hide stale or partial-data state.
- Do not duplicate Convex normalization or comparison rules in components.
- Use TanStack Start server functions only for HTTP/SSR-specific behavior.
- Treat `routeTree.gen.ts` as generated output.
- Browser analytics are explicit PostHog events only. Keep autocapture and
  session recording disabled unless the event contract is revisited.
- Analytics may include hashed normalized RSNs, source statuses, buckets, and
  route/view names. Do not send raw RSNs, full snapshots, or search text.
- Boss icon URLs in `src/bossIcons.ts` are OSRS Wiki MediaWiki
  `pageimages` thumbnails keyed by canonical Hiscores activity names. Prefer
  refreshing that lookup from the Wiki API when Hiscores adds boss rows instead
  of introducing provider-specific names into page components.

## Analytics Environment

Set these when browser analytics should be enabled:

```bash
VITE_POSTHOG_PROJECT_TOKEN=
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_POSTHOG_ENVIRONMENT=production
VITE_POSTHOG_DISABLED=false
```

If the project token is missing, or `VITE_POSTHOG_DISABLED=true`, analytics
calls no-op.

## Implementation Notes

The root route is the public landing page; rating and leaderboard have their own
routes. The parent comparison route owns player search, source health, refresh
lifecycle, and shared comparison context. Child routes render category-specific
views against canonical Convex read models. Uncached comparison deep links request
an initial snapshot once; active work and backend cooldowns prevent duplicate
refreshes. Provider failures remain visible instead of implying fresh data.

Leaderboard account filters (`?account=ironman`) and timeline ranges (`?range=7d`)
are validated URL state. Rating workbench state resets with its URL RSN, including
when the name is removed and when navigating back/forward.

`features/analyticsPrivacy.ts` owns the outbound event-property allowlist. Keep
PostHog's public project `token` and anonymous SDK identifiers while excluding
URLs, paths, titles, referrers, person properties, raw RSNs, and arbitrary fields.
The same policy applies to SDK-generated pageleave events.

Decorative motion honors live reduced-motion changes and a persisted pause
preference. WebGL initialization failure leaves the static background usable.
Browser rank assets are lossless WebP; the server OG renderer deliberately uses
PNG originals for compatibility. The server imports them with `?inline` so OG
rendering does not depend on assets emitted only by the client build. Keep intrinsic
dimensions and CSS aspect ratios
when changing either set.


## Interactive primitives

`src/components/primitives` owns the app's styled Base UI controls, using
`@base-ui/react`. `comparison-ui.tsx` re-exports the shared select and segmented
control APIs for existing feature pages. Keep canonical feature logic (XP presets,
minimum skill selection, RSN history) in the app rather than in provider SDKs.

- Use `SearchMultiSelect` for searchable multiple selections and `SelectField`
  for a fixed single value. Player search uses Autocomplete because arbitrary
  RSNs are valid, even when they are absent from recent suggestions.
- Use `SegmentedControl` (Radio Group) for mutually exclusive filters. Route
  navigation remains router links.
- Popups use Base UI portals and positioners. Their styles must not depend on
  `.scoreboard-shell` ancestry. `primitives.css` is loaded by the root route;
  `.rr-app-root` isolates page stacking from portaled overlays.
- Anchored popups share a 150ms fade/scale transition using Base UI's
  `--transform-origin` and entry/exit attributes. Honor reduced motion.
- Heatmap rows share one Popover root/popup across their day triggers. Each
  calendar has one Tab stop with arrow-key day/week navigation and Home/End
  shortcuts. Details support hover, keyboard activation, and click/tap; Recharts
  keeps ownership of chart tooltips.
- Keep document scrolling on the viewport: `body` must not become a separate
  scroll container, or sticky headers stop following page scroll. Comparison
  headers intentionally scroll away below the 820 px breakpoint.
- Quest differences require known completion states for both players. Preserve
  unavailable counts as null, and keep efficiency smoothing denominators tied
  to the actual sampled duration. Regression fixtures live in `tests/secondPass.test.ts`
  and `tests/questRendering.test.ts`.
- Activity totals require every contributing score to be known. Charts retain
  nulls and use paired tooltips with `filterNull={false}` to distinguish unavailable
  data from measured zero. Hiscores rank availability is independent of score
  availability. Keep both concepts separate in rank counts and badges.
- Combat-repair deduplication must fall back to the normal stale-refresh key
  after a repair attempt. `tests/thirdPass.test.ts` covers persistent failures
  through cooldown expiry and subsequent snapshots.

### Live achievement atlas

The atlas header accepts a RuneScape name and subscribes to compact canonical
progress. With no lookup, the clearly labelled sample remains explorable. A
lookup never falls back to sample completions; loading, unavailable providers,
and untracked evidence use neutral `Unknown` nodes. A public RuneProfile is
required, and node details explain partial or unsupported evidence.

Catalog/layout/assets stay bundled and browser-cached. Account evidence is
requested only for the selected node. Progress changes update node and edge
styles without changing graph coordinates, viewport, or map camera target.

Account selection is stored in `/achievements?rsn=IronBaedin`. Search validation
normalizes spacing and rejects invalid RSNs before querying the backend. Direct
links, reloads, and Back/Forward all check the URL-selected account; clearing
the account removes the parameter. Late responses from a previous lookup cannot
replace the current account's request state.

Account loading shares comparison's freshness checks: missing snapshots load
automatically, and expired snapshots refresh when the server cooldown permits,
including while the page stays open. Fresh enrolled accounts reuse saved progress.
Missing or outdated atlas results automatically rebuild against the current
compiled catalog, even during the provider cooldown. Automatic attempts are
deduplicated per snapshot/catalog version so failures do not create retry loops.

## September 2026 content audit

The 80 milestones added on September 27 cover the silklined herb sack, gem
container chain, Brutus quest/rewards, elemental jewellery, prayer scrolls,
Vampyrium and Wyrmscraig rewards, Sailing quests/equipment/trials, dog adoption,
and cosmetic upgrades. Existing Brutus kill-count/task/log nodes are reused.

Authoring references (release posts, followed by current recipe checks):

- [Royal Titans, February 5, 2025](https://secure.runescape.com/m=news/royal-titans?oldschool=1): Deadeye, Mystic Vigour and Giantsoul amulet.
- [Yama, May 14, 2025](https://store.steampowered.com/news/posts/?enddate=1747216540&feed=steam_community_announcements): Soulflame horn and Rite of vile transference.
- [The Final Dawn, July 23, 2025](https://secure.runescape.com/m=news/varlamore-the-final-dawn-out-now?oldschool=1): Antler guard and Earthbound tecpatl.
- [Sailing, November 19, 2025](https://secure.runescape.com/m=news/sailing-is-out-today?oldschool=1): island weapons, Horn of Plenty, Barracuda reward tiers, introductory quests and medallion.
- [Cosmetic upgrades, January 21, 2026](https://secure.runescape.com/m=news/holy-moleys-and-the-hooded-slayer-helm-are-here?oldschool=1): Holy Moleys.
- [Cow Boss, February 25, 2026](https://secure.runescape.com/m=news/cow-boss-is-out-today?oldschool=1): The Ides of Milk, Brutus rewards and silklined herb sack.
- [Gem containers, May 13, 2026](https://secure.runescape.com/m=news/sailing-changes-and-gem-bag-expansion?oldschool=1): pouch (12 Crafting), satchel (39), tote/sack (81), and immaculate mole skin.
- [The Red Reef, May 20, 2026](https://secure.runescape.com/m=news/the-red-reef-is-out-today?oldschool=1): quest, Bosun’s bench and updated medallion use on Fossil Island.
- [The Blood Moon Rises, June 30, 2026](https://secure.runescape.com/m=news/the-blood-moon-rises---out-today?oldschool=1): Crimson kisten, bloodwood, stymphikes, leechfin and seeker arrows. No failed-poll leechfin sandwich entry.
- [Wyrmscraig, July 29, 2026](https://secure.runescape.com/m=news/wyrmscraig-is-out-today?oldschool=1): Hallowfell and Jeweller’s chisel.
- [Skilling sweep, August 19, 2026](https://secure.runescape.com/m=news/summer-sweep-up---hunter--skilling?oldschool=1): Spirit Flake purchases, abyssal needle purchase and fish sack price.
- [Elemental jewellery, September 2, 2026](https://secure.runescape.com/m=news/summer-sweep-up-miscellaneous?oldschool=1): all four jewels and amulets, combined elemental amulet and Necklace of Fangs.
- [Animal quests, September 8, 2026](https://secure.runescape.com/m=news/a-ruff-situation--crab-quest-out-today?oldschool=1): A Ruff Situation, Crab Quest, dog adoption, and confirmation that the proposed elemental amulet nerf did not ship.

Current Wiki recipes additionally confirm [60 Smithing for the aquanite hopper](https://oldschool.runescape.wiki/w/Aquanite_hopper),
[63 Sailing and eight distinct medallion fragments](https://oldschool.runescape.wiki/w/Medallion_of_the_Deep),
[blowpipe Fletching levels](https://oldschool.runescape.wiki/w/Blowpipe), and
[Troubled Tortugans prerequisites](https://oldschool.runescape.wiki/w/Troubled_Tortugans).

Completion follows the existing atlas conventions: item nodes use collection-log
acquisitions; recipe routes combine key drops with relevant skills/quests. Ordinary
materials and assembly are described in the details. Gem pouch/satchel/tote nodes
are Crafting unlocks, not observations of crafted items. Quest rewards such as dog
adoption and seeker arrows track the unlock, not a puppy purchase or arrows made.
The unlimited perfected quetzal whistle and hooded Slayer helmet are excluded
because current providers cannot report their unlocks. Do not add milestones
whose completion cannot be established from provider evidence.
RuneProfile’s pinned catalog already has the new drops;
its canonical name is `Immaculate mole skin` (two words), not `Moleskin`.

New sprites missing from the installed icon package are bundled locally.
`src/assets/atlas/recent-sources.json` records their Wiki pages and image URLs;
no runtime Wiki or image fetch is needed.

### Treasure Trail unlocks

Clue paths use actual rewards instead of arbitrary completion counts. The six
existing `clues-<tier>` IDs now represent minor scroll case eligibility; each
connects to a major case and the tier's unique reward. These use official
Hiscores completion counts and do not assert that a case was opened or that a
reward is currently owned. Missing/unranked counts remain unknown.

| Tier | Minor case (+1 slot) | Major case (+1 slot) | Unique reward |
| --- | ---: | ---: | --- |
| Beginner | 50 | 100 | Explore emote — 600 |
| Easy | 100 | 200 | Large spade — 500 |
| Medium | 100 | 250 | Clueless scroll — 400 |
| Hard | 50 | 150 | Uri transform emote — 300 |
| Elite | 50 | 150 | Heavy casket — 200 |
| Master | 25 | 75 | Scroll sack — 100 |

`clues-stackable` checks completion of X Marks the Spot for the base capacity of
2 per tier. `clues-mimic-case` checks the canonical logged Mimic scroll case,
whose use grants +1 across all tiers, allowing a maximum of 5. The logged case
proves acquisition, not consumption. A generic Mimic KC does not establish which
casket reward was received. Links between clue nodes show progression and context;
they do not require quest or collection data to establish count-based eligibility.

Verified September 28, 2026 against the official
[stackable clues update](https://secure.runescape.com/m=news/stackable-clues-are-here?oldschool=1),
[scroll case milestones](https://oldschool.runescape.wiki/w/Scroll_case), and
[unique clue milestones](https://oldschool.runescape.wiki/w/Combat_only_pure/End-game#Clue_milestones).
The Treasure Trail group has six parallel clue paths. Scroll case and item reward sprites use the existing bundled
icon package; emotes use their clue tier's icon.
