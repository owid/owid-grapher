# Scaffolding a bespoke project

Copy `bespoke/projects/example/` and rename it (`@owid/bespoke-<name>`); the yarn workspace picks it up — run `yarn install` from `bespoke/`. Copy `vite.config.ts` and `tsconfig.json` verbatim. In `src/index.tsx`, keep `mount` and replace `VARIANTS`, `CONFIG_SPEC` and the `ExampleConfig` type with your own. The readme covers registering the bundle, the dev server, and the production build.

A library that has to be a singleton goes in `DEDUPED_PACKAGES` (`bespoke/shared/viteDedupe.ts`), which every project's vite config points `resolve.dedupe` at; its docblock says why each entry is there.

## Config parsing

ArchieML config values are always **strings**. Declare them in `CONFIG_SPEC` in `src/index.tsx`, modelled on `food-trade/src/index.tsx`.

Support the conventional keys where they make sense: `title`, `subtitle` (override the generated ones), `hideControls`, and an entity default (`country` or `region`) that accepts the sentinel `"userLocation"`, resolved with `useResolveUserLocation` — a react-query hook, so the variant needs a `QueryClientProvider` even when the project fetches nothing else.

`urlSync` and `hideMetadataModal` describe the embedding page rather than the viz, so they stay out of `CONFIG_SPEC`: `parseConfigFromSpec` parses them too, and `EmbedConfigProvider` in the variant's provider stack hands them to the code that needs them.
