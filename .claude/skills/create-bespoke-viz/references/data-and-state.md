# Data loading and state

## Data loading

Bespoke data is fetched at runtime, never bundled. Every project's `src/core/data.ts` (or `fetch.ts`) shows the shape; the conventions behind them:

- Pre-processed JSON on the public bucket `https://owid-public.owid.io`, under a project-named directory — one small `*.metadata.json` plus per-key data files (per entity, product, or whatever the primary selector is), so changing the selection fetches one small file.
- `@tanstack/react-query` with `fetchJson` from `@ourworldindata/utils`, one `QueryClient` at module scope. Query keys namespaced by project, `staleTime: Infinity` (the files are immutable within a session), and `placeholderData: (prev) => prev` so the old chart stays visible while switching entities.
- Data files are usually column-oriented parallel arrays; reshape into rows or Maps client-side, resolving IDs through the metadata. A metadata class with lazily-built lookup maps (`causes-of-death/src/core/CausesOfDeathMetadata.ts`) keeps this tidy.
- Defensive code (clamps, dedupes, guards) hides data anomalies from the screen, so say what you worked around — the upstream fix stays actionable.

## Choosing where state lives

- **Plain `useState`** — the default for anything not shareable.
- **`useUrlState` (nuqs)** — for state that should be deep-linkable (selected country, year, view). Namespace the query keys with a project prefix (`causesOfDeathRegion`, `migrationYear`), since multiple components share one article URL. The hook takes the `urlSync` flag from the embed config and falls back to `useState` when it's off, so there's nothing to gate at the call site. Requires `<NuqsAdapter>` at the top of the variant tree.
- **jotai module-scope atoms** — only for cross-variant shared state, which the readme covers. Not for a single-variant project.
