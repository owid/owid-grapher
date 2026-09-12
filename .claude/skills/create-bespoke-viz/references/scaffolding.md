# Scaffolding a bespoke project

Copy `bespoke/projects/example/` and rename it (`@owid/bespoke-<name>`); the yarn workspace picks it up — run `yarn install` from `bespoke/`. Copy `vite.config.ts`, `tsconfig.json` and `src/index.tsx` verbatim. The readme covers registering the bundle, the dev server, and the production build.

A library that has to be a singleton goes in `DEDUPED_PACKAGES` (`bespoke/shared/viteDedupe.ts`), which every project's vite config points `resolve.dedupe` at; its docblock says why each entry is there.

## Config parsing

ArchieML config values are always **strings**. Every project has a `src/core/config.ts` exporting its config interface plus a `parseConfig(raw: Record<string, string>)` — `food-trade/src/core/config.ts` is the model — built from the shared value parsers in `bespoke/helpers/config.ts`. Keep project-specific parsers local.

Support the conventional keys where they make sense: `title`, `subtitle` (override the generated ones), `hideControls`, and an entity default (`country` or `region`) that accepts the sentinel `"userLocation"`, resolved with `useResolveUserLocation`.

`urlSync` and `hideMetadataModal` describe the embedding page rather than the viz, so they stay out of your config: the mount reads them with `parseEmbedConfig`, and `EmbedConfigProvider` in the variant's provider stack hands them to the code that needs them.
