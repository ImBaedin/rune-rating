# Third UI release review — September 25, 2026

All seven findings are repaired in the `UIOverhaul` working tree, with regression
coverage. Validation was completed before preparing the pull request;
no deployment was published during these checks.

## Resolved findings

- [x] **Social-card rank artwork:** PNGs use Vite's explicit inline imports so
  the server bundle contains the images. Rendering no longer depends on asset
  URLs that the client build does not emit. The production-image regression
  checks visible pixels in the rank-art region, not just HTTP status/MIME type.
- [x] **Tablet efficiency layout:** the 721–1100 px range stacks the panels, and
  the page grid can shrink within its container. Browser tests cover eleven
  viewport widths from 320 to 1280 px, including both sides of each breakpoint.
- [x] **Refresh recovery:** only unused combat-repair keys take priority. A used
  repair key falls back to the normal stale-refresh key, respecting active
  work, cooldowns, and deduplication. Regression fixtures exercise successive
  snapshots with a persistent combat-data failure.
- [x] **Missing snapshots and genuine ties:** bossing, minigame, and clue totals
  require known contributing scores. Loading, unavailable/partial data, zero,
  tied scores, and either player's lead remain distinct. Clue table totals use
  the same rules; unavailable rank gaps no longer become zero.
- [x] **Unavailable chart values:** activity, bossing, minigame, clue, and
  collection chart adapters preserve null values. Shared paired tooltips show
  “Unavailable,” while measured zero remains zero. Missing collection data
  no longer creates a false empty-completion ring.
- [x] **Minigame rank labels:** counts and badges use Hiscores rank availability.
  Known scores remain visible even when the player is unranked. Clue availability
  labels describe score availability rather than incorrectly claiming a rank.
- [x] **Skip-link destinations:** comparison content is focusable, and comparison
  and public content targets have sticky-header offsets. The comparison offset
  is removed on phones where the header intentionally scrolls away.

The follow-up review also corrected mobile podium typography: the winner's score
uses the 84 px rule, while second/third place retain their 48 px size.

## Final verification

- **81 unit tests passed:** 57 domain/SDK/backend and 24 web tests. New fixtures
  render the real activity pages and capture their chart inputs, covering absent
  data, partial values, real zeros/ties, both lead directions, and rank availability.
- **93 browser tests passed:** 31 each in Chromium, mobile Chromium, and WebKit
  against the final production preview. New checks exercise tablet layouts,
  keyboard skip focus/visibility, and actual OG artwork.
- Typecheck, lint, production client/SSR build, and `git diff --check` pass.
  Lint retains the 107 existing maintenance warnings.
- CodeRabbit's final uncommitted review returned zero findings. New untracked
  helpers and test files were also manually reviewed.
- React Doctor returned zero errors and sixteen maintenance warnings, score 66/100.
- Manual visual checks confirmed the restored rank image, the 768 px efficiency
  layout, and the corrected 390 px leaderboard typography. The final preview
  logged no missing-artwork errors.

Hosted Netlify verification and physical-device native sharing/touch checks
remain on `PRE_SHIP_REVIEW.md`. Local tests use the connected sample dataset;
provider failure cases use isolated fixtures. No provider records were manually
edited during these checks.
