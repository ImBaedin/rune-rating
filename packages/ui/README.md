# `@rune-rating/ui`

Reserved workspace package for RuneRating's reusable component system. The
current web app still keeps most feature UI in `apps/web`; promote stable
components here once the frontend structure is split.

## Visual Direction

Use a restrained analytical-publishing aesthetic: neutral surfaces, crisp
separators, dense but readable tables, and one stable accent per compared
player. The interface should feel like a professional data terminal, not a game
client. Avoid medieval motifs, parchment, OSRS textures, and decorative chrome.

## Planned Structure

```text
src/
  primitives/       # Base UI wrappers and visual tokens
  dashboard/        # cards, tables, sidebar, source-state panels
  charts/           # Recharts wrappers and comparison conventions
  states/           # loading, stale, partial, unavailable, error
  styles/           # tokens, typography, density, themes
```

## Component Rules

- Base UI provides interaction, focus management, and accessible behavior.
- Bespoke CSS owns appearance; do not create a second component framework.
- Components accept canonical read models, never source DTOs.
- Partial-data treatment must preserve readable explanations.
- Comparison charts share domains, units, and aligned time ranges.
- Color is supporting information, never the only indication of leadership or
  failure.

Good extraction candidates: source chips, comparison page headers, player
summary cards, loading/empty/unavailable states, search/select fields, metric
comparison cards, aligned XP charts, skill tables, and pagination controls.
