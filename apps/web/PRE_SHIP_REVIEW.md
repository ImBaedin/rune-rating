# UI overhaul release checklist

Reviewed and repaired September 25, 2026 on `UIOverhaul`, including the existing
UI overhaul. Validation was completed before preparing the pull request;
no deployment was published during these checks.

**Second review:** All ten additional findings are repaired, with regression
coverage. See [SECOND_PASS_REVIEW.md](SECOND_PASS_REVIEW.md) for the resolutions.

**Third review:** All seven additional findings are repaired, with regression
coverage. See [THIRD_PASS_REVIEW.md](THIRD_PASS_REVIEW.md) for the resolutions.

## Fixed

- [x] Uncached comparison deep links now request their first snapshot. Refresh keys are normalized and deduplicated per player, and respect active work and cooldowns. Terminal Hiscores failures have an explicit unavailable message.
- [x] PostHog events use an outbound allowlist that removes raw URL/path/title/referrer and person properties, while preserving the public ingestion token, anonymous IDs, route names, and approved hashed fields. Actual SDK transport tests cover pageview, explicit clicks, and automatic pageleave.
- [x] Missing timeline values stay unavailable instead of becoming zero, a tie, or a winning player. Headlines, insights, and summary rows require mutually available values.
- [x] Every public Compare link points to the canonical sample comparison.
- [x] Rating input/card/feedback reset when the URL name changes or disappears. Refresh tracking survives the keyed workbench; refresh failures do not prevent navigation to the requested player.
- [x] Hiscores, WOM, and RuneProfile health badges reflect provider state and age. Unknown page-level source chips use a neutral default.
- [x] Leaderboard rows have explicit accessible metric labels, with visible collection labels on phones. Empty results and a podium-only leaderboard have clear messages.
- [x] Invalid live leaderboard search input no longer calls a rejecting backend query and crashes the page. It displays inline guidance instead.
- [x] Copy, native share, and PNG-export failures are handled. User cancellation of native sharing is ignored. Validation/status feedback is announced.
- [x] Removed `apps/web-legacy` after route/feature comparison. Its local tree, including ignored files, was preserved at `/tmp/rune-rating-release-backup-1790388429/web-legacy`.
- [x] Repository lint passes. Generated Netlify and browser-test output is excluded, and remaining source/config formatting errors are fixed.
- [x] Added Bun regression tests and a repeatable Playwright smoke suite. Web tests replace the old echo-only test script and are included in TypeScript checking.
- [x] Removed obsolete font requests, unused mock data, and unused intermediate rank artwork. Browser rank images and sheet use pixel-verified lossless WebP: 2,849,008 to 1,904,054 bytes (33% smaller). PNG originals remain only for server OG compatibility. Images have intrinsic dimensions and responsive sizing.
- [x] Added public skip links, improved small scoreboard metadata to a 10 px minimum, and checked phone layouts.
- [x] Leaderboard account filters and timeline date ranges are shareable validated URL state.
- [x] Decorative animations can be paused, react to system reduced-motion changes, and fall back to static backgrounds without WebGL.
- [x] Updated the landing page metadata and README to reflect public routes, current behavior, privacy, and test commands.
- [x] Added full-page home and sample-comparison recovery links to error, not-found, and invalid-player-name pages, plus a reload control for errors. Shared recovery controls have visible keyboard focus and 44 px minimum touch targets.
- [x] Removed the duplicate `VITE_CONVEX_URL` example, added `VITE_SITE_URL`, and documented preview sharing configuration and hosted/device verification in the web README.

## Verification

| Check | Final result |
| --- | --- |
| `bun run typecheck` | Passed, all six packages; web tests/config included |
| `bun run test` | Passed, 81 tests: 57 domain/SDK/backend plus 24 web tests |
| `bun run lint` | Passed; 107 existing warnings remain, mainly CSS specificity/`!important` |
| `bun run build:web` | Passed client and SSR builds, including the Netlify entry point |
| `APP_BASE_URL=http://localhost:3001 bun run test:browser` | 93 passed against the production preview: 31 each in Chromium, mobile Chromium, and WebKit |
| CodeRabbit uncommitted review | Final rerun reported no findings; untracked additions also manually reviewed |
| React Doctor | Zero errors; 16 complexity/size warnings, score 66/100 |
| `git diff --check` | Passed |

Provider-state regression tests cover pending queries, missing profiles, never-successful
snapshots, active refreshes, cooldowns, failed/unavailable/rate-limited sources, and
staleness. Timeline tests cover absent values, genuine zero, ties, and winners.

The browser suite exercises all 12 comparison routes; public navigation; rating URL
reset and history; invalid/empty leaderboard search; URL filters; keyboard metric
selection; dialog Escape/focus return; recent-player keyboard autocomplete; Dragon warhammer collection lookup; dynamic
reduced motion and missing WebGL; PNG download; clipboard rejection/native-share cancellation; and the OG image endpoint. Analytics
payloads are captured against a local test endpoint with real PostHog SDK code. The
connected provider dataset is not a deterministic fixture and no outage is forced.

Manual visual checks covered the desktop rating card and the 390 px leaderboard,
including compact metric labels and public navigation. The second pass also
checked heatmap details, diary tier totals, sticky headers, and intermediate
desktop widths from 821 to 1440 px. Browser regressions now cover heatmap roving
focus, advertised comparison URLs, actionable clue targets, and efficiency ticks.
The third pass adds tablet efficiency breakpoints, visible/focusable skip-link
destinations, and pixel-level verification that production OG cards contain rank art.

After the recovery/configuration cleanup, build, typecheck, all 81 unit tests,
and all 93 browser tests passed again. Lint retains the same 107 warnings;
React Doctor retains zero errors and 16 maintenance warnings. Manual production-preview
checks verified navigation home from a 404 and into the sample comparison from an
invalid-name page. Recovery controls fit at 320 px with 44 px touch targets.

## Before publishing

- [ ] Run the smoke suite against the actual Netlify deploy preview with its intended Convex environment. Verify deployment-specific routing, OG absolute asset URLs, and production configuration. Local build/preview checks do not establish that hosted configuration is correct.
- [ ] Verify native sharing and touch behavior on a physical iOS/Android device. WebKit and a Chromium touch viewport cover browser behavior, not the operating system's native share sheet.

The final local cleanup did not complete these two checks: a Netlify deploy-preview
URL is still needed, no Android device was connected, and iOS device tooling was
unavailable on this machine. See the web README for the hosted test command and
physical-device checklist.

## Future maintenance

The broad CSS cascade consolidation and further decomposition of large feature
pages remain maintenance follow-ups. The release fixes extract refresh, privacy,
URL-validation, and timeline-comparison logic; a full visual rewrite is deliberately
outside this correctness pass. Existing CSS specificity warnings and component
complexity warnings are not suppressed. Establish screenshot baselines before
reordering the remaining base/scoreboard cascade.
