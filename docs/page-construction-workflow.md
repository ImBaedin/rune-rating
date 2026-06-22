# Page Construction Workflow

Use this workflow for each remaining RuneRating comparison page.

## 1. Define The Slice

- Name the page, route/search state, source owner, and first useful MVP.
- Identify the smallest canonical Convex read model needed by the page.
- Prefer existing cached comparison or timeline actions before adding a new endpoint.
- Do not fetch external providers from the browser.

## 2. Generate The Mockup

Before implementation, write an image-generation prompt for a high-fidelity page
mockup that matches the existing RuneRating shell:

- dark left sidebar
- sticky comparison/search topbar
- light gray workspace
- compact, data-dense panels
- blue left-player accent and green right-player accent
- explicit loading, partial, stale, and unavailable states where relevant

Keep the mockup operational, not promotional. Avoid fantasy styling, oversized
hero sections, nested cards, decorative blobs, and one-note purple or beige
palettes.

## 3. Build The Page

- Wire navigation and route/search validation.
- Add the page component close to the existing completed slice patterns.
- Derive secondary page metrics locally from one bounded backend response.
- Use Recharts for charts.
- Reuse `apps/web/src/components/XpActivityHeatmap.tsx` for activity heatmaps
  instead of creating page-local heatmap grids.
- Preserve `null` as missing data. Never convert missing provider data into
  zero activity, zero progress, or a losing comparison.

## 4. Backend And API Discipline

- Read `packages/backend/convex/_generated/ai/guidelines.md` before Convex edits.
- Keep provider credentials and fetches in Convex actions.
- Batch same-page provider needs where the provider API allows it.
- Add or reuse Convex cache tables/actions with explicit TTL and backoff.
- Prefer one cached page request per player pair and active range.
- Do not add polling or automatic fan-out across inactive pages.

## 5. Verification

For each page:

```bash
bun run --filter @rune-rating/web typecheck
bun run --filter @rune-rating/web lint
```

Then run the app and inspect the page with Playwright at desktop and mobile
viewports. Check:

- no console errors or warnings
- no overlapping text
- compact controls fit at supported widths
- stale/partial/missing states are visible
- changing range or mode does not trigger unnecessary provider fan-out

## 6. Sub-Agent Workflow

Run the page build with sub-agents only after the comparison shell and route
structure are stable. Each worker must own a disjoint page route and avoid
editing files owned by another worker.

Coordinator responsibilities:

- Keep `App.tsx`, route wiring, shared navigation, shared styles, and shared
  components under coordinator ownership unless a worker is explicitly assigned
  a narrow edit there.
- Give each worker the relevant generated mockup image, page route, backend data
  contract, and verification commands.
- Require workers to use Recharts for charts and `XpActivityHeatmap` for
  heatmap-style activity grids.
- Require workers to read `packages/backend/convex/_generated/ai/guidelines.md`
  before Convex edits.
- Review each worker result for API fan-out, missing-data handling, and visual
  fit before merging the next worker's output.

Recommended worker split:

- Worker A: `quests.tsx` and Quest page-specific components.
- Worker B: `achievement-diaries.tsx` and Diary page-specific components.
- Worker C: `bossing.tsx`, `clues.tsx`, and `minigames.tsx` only if the shared
  RuneProfile read model is already available.
- Worker D: `collections.tsx` and granular search UI after definitions/search
  contracts are confirmed.

Worker prompt template:

```text
You are implementing one RuneRating comparison page in a shared workspace.
Do not revert or rewrite unrelated edits. Own only:
- <route file>
- <page component file(s)>
- <narrow style block or CSS module>

Before coding, inspect the existing route/page patterns and the provided mockup.
Use Recharts for charts and reuse XpActivityHeatmap for heatmaps. Do not add
browser-side provider calls. If Convex edits are needed, first read
packages/backend/convex/_generated/ai/guidelines.md and keep provider fetches in
actions with bounded cached responses.

Run:
bun run --filter @rune-rating/web typecheck
bun run --filter @rune-rating/web lint

Return changed files, verification results, and any residual risk.
```

## Page Order

1. Activity
2. Quests
3. Achievement Diaries
4. Bossing
5. Clues
6. Minigames
7. Collections
