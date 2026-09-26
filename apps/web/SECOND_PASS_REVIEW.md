# Second UI release review — September 25, 2026

All ten findings from the second review have been repaired in the working tree
on `UIOverhaul`. Validation was completed before preparing the pull request;
no deployment was published during these checks.

## Resolved findings

- [x] **Social-preview comparison URLs:** preserve percent-encoded spaces in
  path segments, so the advertised URL passes RSN validation.
- [x] **Unavailable quest data:** only known completion states can establish a
  difference. Missing point-band counts remain unavailable; empty difference
  lists no longer claim both players match when a source is missing.
- [x] **Efficiency daily rates:** divide gains by the actual sampled interval,
  including windows shorter than the fourteen-day smoothing period.
- [x] **Automatic refresh timing:** use the current wall clock when profiles
  change, both for eligibility and the next scheduled stale check. Active
  refreshes and backend cooldowns remain respected.
- [x] **Heatmap keyboard access:** each player's calendar has one Tab stop.
  Arrow keys navigate days/weeks; Home/End navigate the row; Control+Home/End
  reach the first/last day. Enter opens details and Escape restores focus.
  Unknown days announce “No data.”
- [x] **Player names matching routes:** read the category after both RSNs, so
  names such as `skills` cannot select a child page on the overview route.
- [x] **Clue rank targets:** filter achieved thresholds before selecting targets,
  consistently use the named right-hand player, and preserve unknown ranks.
  Top-N targets include rank N.
- [x] **Diary totals:** “Overall tier completions” displays completed tiers,
  not completed tasks. The checked sample now shows 48 and 47.
- [x] **Tied social previews:** known ties produce a tied comparison; only an
  entirely unknown comparison produces the pending-data label.
- [x] **Efficiency axis ticks:** preserve fractional tick positions and format
  labels independently, removing duplicate positions and labels.

The follow-up review also repaired the page overflow rules that prevented sticky
headers from following viewport scrolling. Flexible comparison-header columns
keep controls inside intermediate desktop widths. Phone comparison headers
retain their intentional scrolling behavior.

## Regression coverage

Nine new Bun tests cover these calculations, URL parsing/encoding, unknown data,
refresh deadlines, and OG ties. One renders the real quest page with an unavailable
counterpart and asserts that it cannot claim “missing,” “only,” or an equal match.

Five additional browser checks per engine cover advertised social URLs, heatmap
keyboard navigation/popover focus, clue targets, efficiency axis ticks, and header
scrolling. The suite uses Chromium, mobile Chromium, and WebKit against the
production preview. See `PRE_SHIP_REVIEW.md` for the final validation results.

CodeRabbit's final uncommitted review reported no findings. New untracked files
were also manually reviewed. React Doctor reported no errors and sixteen
maintainability warnings. Existing CSS warnings remain documented maintenance
work, rather than being suppressed.

## Remaining release checks

Run the smoke suite against the actual Netlify deploy preview and verify native
sharing/touch behavior on physical devices, as listed in `PRE_SHIP_REVIEW.md`.
Local browser testing uses the connected provider dataset; provider failure cases
are isolated unit fixtures. No provider records were manually edited.
