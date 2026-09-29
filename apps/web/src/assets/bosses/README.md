# Boss portraits

Bundled 96px OSRS Wiki portraits used by the shared boss icon registry. Game artwork © Jagex. Original image URLs and retrieval date are recorded in `sources.json`. Reused portraits share one local file; Vite fingerprints and serves these assets with the app. No runtime Wiki image requests are needed.

When adding a boss, download its portrait once, verify its image format, record its source, and import the local asset in `src/bossIcons.ts`. Keep source URLs out of the runtime registry.
