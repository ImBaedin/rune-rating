# `@rune-rating/domain`

Source-independent RuneRating vocabulary shared by the backend and web app.

## Owns

- Canonical metric keys and categories.
- Read-model TypeScript types.
- Source availability and freshness vocabulary.
- Null-aware comparison result types.
- Pure comparison and formatting rules that are valid in any runtime.

## Does Not Own

- Convex document IDs or database access.
- External source DTOs.
- HTTP clients, caching, or retries.
- React components.

The domain package should remain small and dependency-light. Runtime validation
for persisted data belongs in the Convex backend; source validation belongs in
the relevant SDK.

