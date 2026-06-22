# `@rune-rating/sdk-wise-old-man`

Thin client for Wise Old Man.

Owns request construction, authentication if required, response validation,
source fixtures, rate-limit hints, and transport error mapping. It may expose
profile, snapshot/history, activity, EHP, and EHB DTOs supported by the source.

A missing Wise Old Man player is a normal `notConnected` result, not a failed
RuneRating player lookup. Caching, retries, normalization, and retention belong
to the Convex backend.

Requests must send an identifiable `User-Agent`; Wise Old Man's edge protection
may reject generic clients with HTTP 403.
