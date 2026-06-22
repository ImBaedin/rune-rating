# `@rune-rating/web`

TanStack Start application for RuneRating.

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
  compare/$leftRsn/$rightRsn.tsx
  compare/$leftRsn/$rightRsn/
    index.tsx
    skills.tsx
    xp-timeline.tsx
    efficiency.tsx
    activity.tsx
    quests.tsx
    achievement-diaries.tsx
    bossing.tsx
    clues.tsx
    minigames.tsx
    collections.tsx
```

The parent comparison route owns the shell, sidebar, player headers, source
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

The root route redirects to the default comparison URL. The parent comparison
route owns the shell, player search, source health, refresh lifecycle, and
shared comparison context. Child routes render category-specific views against
canonical Convex read models.
