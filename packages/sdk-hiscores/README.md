# `@rune-rating/sdk-hiscores`

Thin client for the official OSRS hiscores endpoints.

Owns request construction, timeouts, parsing the source response, DTO
validation, source fixtures, and transport error mapping. It returns validated
hiscores DTOs and never writes canonical models or Convex documents.

Hiscores is the baseline source for current skill, XP, rank, bossing, clue, and
minigame values where the endpoint exposes them. The parser must tolerate
documented endpoint variants without silently shifting positional fields.

