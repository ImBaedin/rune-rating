# `@rune-rating/sdk-runeprofile`

Thin client for RuneProfile.

Owns request construction, authentication if required, response validation,
source fixtures, and transport error mapping. It exposes only validated source
DTOs and source-specific metadata needed by backend normalization.

A missing or private RuneProfile account must map to an explicit availability
state. It must not cause unrelated hiscores or Wise Old Man comparisons to fail.

The current player snapshot client fetches the account summary, quests,
achievement diaries, and combat-achievement tasks in parallel. Full
collection-log detail is available through a separate demand-driven fetcher so
normal player refreshes remain lightweight.

RuneProfile permits anonymous requests at a lower rate limit. Set the optional
`RUNEPROFILE_API_KEY` Convex environment variable to send an `X-API-Key` header.
