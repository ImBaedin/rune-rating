# `@rune-rating/web`

TanStack Start application for RuneRating.

This is the production Scoreboard 2.1 frontend. The legacy application has been
removed after checking the replacement routes and interactions.

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
