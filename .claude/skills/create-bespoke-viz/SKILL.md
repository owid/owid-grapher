---
name: create-bespoke-viz
description: Create or extend a bespoke data viz project under bespoke/projects/ — self-contained, Shadow-DOM-embedded visualizations for OWID articles. Use when scaffolding a new bespoke project, building its layout/controls, choosing shared components, or deciding what to reuse from the grapher packages.
metadata:
    internal: true
---

# Creating Bespoke Data Viz

Bespoke projects are one-off, self-contained visualizations embedded in OWID articles via Shadow DOM. A project can also be the subject of its own page, a `featured-viz` gdoc at `/featured-viz/<slug>`, where it renders on a blue band and drives the page URL. Read [bespoke/readme.md](../../../bespoke/readme.md) first — it is the authoritative doc for the mount interface, Shadow DOM mechanics, ArchieML embedding, featured viz pages, and jotai-based cross-variant state.

Before starting, **list `bespoke/projects/` and skim the one or two existing projects closest in shape to what you're building** — real projects are the best blueprint for current conventions, and the newest ones reflect them best. `example` is the minimal starter template, maintained to be copied rather than shipped. Projects cited below show where a pattern lives today, not canon — prefer newer precedent if it diverges.

## 1. Scaffolding a new project

Copy `bespoke/projects/example/` and rename (`@owid/bespoke-<name>`); the yarn workspace picks it up — run `yarn install` from `bespoke/`. Copy `vite.config.ts`, `tsconfig.json` and `src/index.tsx` verbatim and keep every piece: the readme documents what they do and covers registering the bundle, the dev server, and the production build. Run `yarn typecheck` and `yarn test` from `bespoke/`, and check the result on the demo page. Pure helpers with real logic (layout algorithms, models, bucketing) get **vitest** tests next to the source.

Two things the readme doesn't cover:

**The dedupe trap.** `resolve.dedupe` in `vite.config.ts` must list every library that has to be a singleton. The linked packages (and the shared `bespoke/components`/`hooks` workspaces) resolve deps against their real paths, so without dedupe you get a second React copy (breaks hooks), a second react-query (breaks the QueryClient context), or a second react-aria (breaks overlays). Baseline is `["react", "react-dom", "@react-stately/flags"]`; existing projects extend it with `"@tanstack/react-query"` and/or the react-aria packages — check the dedupe list (and its comment) in the project closest to yours.

**Config parsing.** ArchieML config values are always **strings**. Every project has a `src/core/config.ts` exporting its config interface plus a `parseConfig(raw: Record<string, string>)` (see `food-trade/src/core/config.ts`), built from the shared value parsers in `bespoke/helpers/config.ts` — `parseBoolean`, `parseNumber`, `parseInteger`, `parseEnum(value, allowed)`, and the `VariantProps<Config>` type. Don't re-roll those; do keep project-specific parsers local. Readers author these values by hand, so a malformed one degrades to `undefined` rather than throwing. For an enum, declare the runtime list and derive the type from it (`const FLOWS = [...] as const; type Flow = (typeof FLOWS)[number]`) so `parseEnum` and the type can't drift apart. Support the conventional keys where they make sense: `title`, `subtitle` (override the generated ones), `hideControls`, `urlSync`, and an entity default (`country` or `region`) that accepts the sentinel `"userLocation"` (resolve it with the `useResolveUserLocation` hook). Treat `urlSync` as required rather than optional if the bundle might ever get its own featured viz page: that page turns the flag on for you, so a project that never reads it syncs nothing and its page URL can't be shared at a particular view.

## 2. Layout: where files go, and how a chart is composed

`src/` holds the entry point, the stylesheets, and three folders:

```
src/
    index.tsx          the mount contract
    index.scss + …     the style import hub (see §6)
    components/        chart pieces, controls, tooltips
    variants/          one file per entry in VARIANTS
    core/              everything non-visual
```

**Everything non-visual lives in `core/`** — `config.ts`, `types.ts`, `constants.ts`,
`data.ts`/`fetch.ts`, `helpers.ts`, hooks, metadata classes, layout algorithms, and their
`*.test.ts` files. Nothing but `index.tsx`, the stylesheets and the boilerplate copied from
`example` sits at the `src/` root. Split `core/` into subfolders only when one part grows into
its own layer (demography's simulation is `core/model/`). A single-variant project can skip
`variants/` and keep the variant in `components/` (causes-of-death does), but the three layers
below still apply.

Every project structures a variant in three layers — follow this naming/altitude convention:

1. `<Name>Variant` — providers (`QueryClientProvider`, `NuqsAdapter`, breakpoint context) plus the width-measuring wrapper div;
2. `Fetching<Name>Variant` — data queries, URL state, and the skeleton / error / empty-state gates;
3. the captioned chart (`Captioned<Name>Variant` / `<Name>CaptionedChart`) — the visual composition below.

For the composition, the standard is two stacked cards: a `Controls` box (gated on `!config.hideControls`) above a `Frame` holding `ChartHeader` → chart area → `ChartFooter`. Inside the controls box, dropdowns/switchers/checkboxes go in a `ControlsRow` and the `TimeSlider` sits outside the row.

Conventions that go with this:

- **Controls are harmonized across all bespoke projects** — don't restyle them per project:
    - the controls box gets no "Configure the data" heading;
    - every dropdown, switcher, and checkbox-style control carries a small gray uppercase label above it — `LabeledDropdown`/`EntityDropdown` render theirs from the `label` prop, anything else goes inside `<LabeledControl label="…">`;
    - a checkbox labels itself, so it gets no label above; the row bottom-aligns its controls so it still lines up;
    - the time slider gets no label.
- **Titles are narrative sentences** generated from the current selection ("What did children under 5 in India die from in 2021?"), not static labels. Format entity names for a sentence with `bespoke/helpers/entityNames.ts`
  (`formatEntityNameForSentence`, `stripEntityNameSuffixes`). An alternative to a controls bar is embedding the entity selector inline in the title (see demography's `InlineEntitySelector`) — nice when the entity is the only control.
- **Loading UX**: skeleton on first load (a simple box with a `<Spinner />` is enough); on refetch keep the old chart visible (react-query `placeholderData`) with a `<Spinner />` overlay (its container needs `position: relative`); gate spinners behind `useDelayedLoading(isPlaceholderData, 300)` so fast loads don't flash. `<Spinner inline />` works inside text, e.g. a subtitle value that's reloading.
- **Errors**: render a plain fallback div with a message; parse defensively (filter bad rows with a `console.warn`) rather than throwing.
- **Empty states**: when the current selection legitimately has no data, show a "no data" message div (optionally with a button switching to a selection that has data) — a third state, distinct from error and skeleton.

## 3. Shared components (`bespoke/components/`), hooks (`bespoke/hooks/`) and helpers (`bespoke/helpers/`)

Before building a control, tooltip helper, sizing hook, or config/label utility, check what already exists: **list `bespoke/components/`, `bespoke/hooks/` and `bespoke/helpers/`** — the names are self-explanatory — and read the prop types / signatures of whatever looks relevant. Two things the filenames undersell: `EntityDropdown` is geolocation-aware (see the ordering below), and `Sankey/` is a full toolkit with bilateral and split-flow layouts — don't build a second Sankey.

Entity dropdowns across projects share a **relevance ordering**: pinned aggregates (e.g. World) → current selection → the user's own country/continent marked with a location icon (via `useUserCountryInformation`) → the rest alphabetically. Reuse that pattern (and the `"userLocation"` config sentinel) rather than a flat alphabetical list.

Form controls that `bespoke/components/` lacks often already exist in **`@ourworldindata/components`** (e.g. `Checkbox`, `RadioButton`, `LabeledSwitch`), styled the Grapher way and following the same opt-in convention — import the matching `.scss` partial.

Non-obvious facts about consuming them:

- Import via **deep relative paths with `.js` extensions** (not the workspace package name), e.g. `import { Frame } from "../../../../components/Frame/Frame.js"`. Vite bundles them into your output.
- Styles are **opt-in**: component `.tsx` files never import their own styles — the consumer must `@import` the matching `.scss` partial in `index.scss`, **after** the OWID SCSS variables are in scope (the partials use `$dark-text`, `$frame-color`, etc. without defining them). See §6.
- Hooks built on react-query (e.g. `useUserCountryInformation`) need a `<QueryClientProvider>` in the variant tree.

`bespoke/shared/` is different: it's code shared with the **site rendering code** (mount types, Shadow-DOM mounting). Don't add project utilities there.

## 4. Reusing utilities from the grapher codebase

The `@ourworldindata/*` packages are linked in per project (`link:../../../packages/@ourworldindata/<pkg>`) — most projects take `utils`, `types`, `grapher` and `components`; the Sankey projects add `core-table`. Add the one you need to `package.json` rather than assuming it's already there. **Before hand-writing any general-purpose helper — number/date formatting, entity/region names, SVG geometry or text layout, tooltips, controls, color logic — always check whether one already exists there.** Ways to check:

- skim the package entry points (`packages/@ourworldindata/{utils,grapher,components}/src/index.ts`) for exported symbols, or grep the packages for a likely name;
- see what existing projects already import: `grep -rh "@ourworldindata" bespoke/projects/*/src`.

A non-exhaustive sample of what projects have reused: `formatValue` (+ `OwidVariableRoundingMode`) for number formatting; the region helpers (`getRegionByName`, …) for region metadata; `Bounds`, `getRelativeMouse`, `isTouchDevice` for SVG geometry and interaction; `Tippy` plus Grapher's `TooltipCard`/`TooltipValue`/`TooltipTable` for tooltips; `TextWrap`/`MarkdownTextWrap`/`Halo` for SVG text; Grapher's `Dropdown` control; `BezierArrow` for annotations (from `@ourworldindata/grapher` — `bespoke/components/BezierArrow/` is just a dev-time debug wrapper with draggable handles for finding offsets); `fetchJson` and URL-param helpers.

For third-party utilities, projects lean on `remeda` (imported as `* as R`) and `ts-pattern`'s `match` — prefer these over hand-rolled loops and switch statements.

Some of these are deep imports (e.g. `@ourworldindata/grapher/src/tooltip/TooltipCard.js`) rather than package-index exports — both are fine. When you deep-import a styled Grapher component, make sure its `.scss` is in scope; the copied `grapher.scss` already pulls in `Dropdown.scss` and (in every project but `example`) `Tooltip.scss`, so only anything beyond those needs adding.

## 5. Visual style & colors

Bespoke charts should read as part of the OWID chart family. For the chart furniture — axis ticks and labels, gridlines, annotations, legends — don't design from scratch: look at how a similar existing project (or Grapher itself) styles these and align with it, matching font sizes, weights, and grays.

Default to the OWID palettes — don't invent hex values. The palettes live in `packages/@ourworldindata/grapher/src/color/`; **browse `CustomSchemes.ts`, `ColorConstants.ts`, and `ColorUtils.ts` for the full range** — there is much more than the examples below (continent/energy/income-group colors, map palettes, single-color gradients, …). Commonly used entry points:

- **Categorical series**: `OwidDistinctColors` (`.../color/CustomSchemes.js`) — the named 24-color palette (`.Denim`, `.Maroon`, …).
- **Text & UI grays**: `GRAPHER_LIGHT_TEXT` (the workhorse for secondary text), `GRAPHER_DARK_TEXT`, `GRAY_5`…`GRAY_100` (`.../color/ColorConstants.js`).
- **Helpers** like `isDarkColor`/`darkenColorForText` (`.../color/ColorUtils.js`) for picking legible label colors on colored marks.

Hardcoding hex is acceptable only for **semantic, domain-specific colors** with no palette equivalent — e.g. causes-of-death's five category colors. Keep those in one constants file with a single accessor (`getCategoryColor(...)`).

## 6. Styling & Shadow DOM

- `src/index.scss` is the single import hub, in this order: `normalize.css` → vendor CSS (Font Awesome's `@fortawesome/fontawesome-svg-core/styles.css`, tippy + its light theme) → `./grapher.scss` (the OWID SCSS partials) → `./base.scss` → your project styles (a single `styles.scss` or per-component partials) → each shared component's `.scss` partial you use. Copy `grapher.scss` from an existing project — it pulls the OWID SCSS partials (colors, variables, typography, mixins) from the `@ourworldindata/components` and `grapher` packages, putting `$sans-serif-font-stack`, `$serif-font-stack`, `$dark-text`, `$gray-*`, and the `sm-only` mixin in scope.
- `base.scss` sets the host font — **use `:host`, not `:root`** inside a Shadow DOM.
- **Fonts**: don't bundle `@font-face` — Lato/Playfair are declared by the host document and `@font-face` is document-scoped, so it works inside the shadow root. Just reference the family names via the SCSS stacks.
- Strict **BEM** with full class names written out (`.my-viz-controls__row`, never `&__row`), per repo convention.
- **Portal gotchas**:
    - Tippy tooltips must portal into the shadow root, not `document.body` — see §7.
    - react-aria dropdown menus portal into the **light DOM** (Enter-to-select is broken in Shadow DOM), so any custom styling inside menu options must be **inline styles** (see the comment in `food-trade`'s controls and `EntityDropdown`'s `LocationIcon`).
    - `dev-only-global-css.css` supplies the global styles those portaled overlays need on the demo page (production articles already have them). Keep this entrypoint.

## 7. Tooltips

Two kinds of tooltips, with different tooling.

**Data tooltips** (hovering chart marks): build on Grapher's tooltip primitives instead of rolling your own chrome. `TooltipCard` (`@ourworldindata/grapher/src/tooltip/TooltipCard.js`) is the positioned card — `x`/`y`, `offsetX`/`offsetY`, `title`, `subtitle`, `containerBounds`, `anchor` — with `TooltipValue`/`TooltipTable` rows (`.../tooltip/TooltipContents.js`) inside; its `Tooltip.scss` comes in via the copied `grapher.scss` (check it's there). The established wiring:

- Hold a hover state of the target plus a `position`; set it on mark hover and update `position` on mouse move with `getRelativeMouse(svgRef.current, event.nativeEvent)`.
- Pass the chart's `containerBounds` to `TooltipCard` so the card flips/clamps instead of overflowing the chart.
- If the pointer crosses gaps between adjacent marks (e.g. treemap tiles), delay hover-out (~200 ms `setTimeout` before clearing the target, cancelled on re-enter) so the tooltip doesn't flicker; for contiguous marks, clearing immediately on `mouseleave` is fine.
- **Touch devices don't hover.** Use `usePinnedTooltip(isActive, onDismiss)`: on touch it returns `isPinned: true` and owns dismissal (tap outside, chart scrolled out of view) — skip your mouse-leave logic there (`if (isTouchDevice()) return`). When pinned, render the card with `anchor={GrapherTooltipAnchor.Bottom}` (from `@ourworldindata/types`) and **no** `containerBounds`, so it sits fixed at the bottom of the viewport instead of following a cursor that doesn't exist.
- Content conventions: title is the hovered mark/series, subtitle adds context, `TooltipValue` rows take the mark's `color`.

**UI tooltips** (info icons, "why is this control disabled"): use `Tippy` from `@ourworldindata/utils`, and always pass `useTippyContainer()`'s `getTippyContainer` as `appendTo` — inside a Shadow DOM, Tippy would otherwise portal to `document.body` where your styles don't reach. Bundle tippy's CSS (and theme) in `index.scss`.

## 8. Data loading

Bespoke data is **fetched at runtime, never bundled**. The established pattern across existing projects:

- Pre-processed JSON hosted on the public bucket `https://owid-public.owid.io` — one small `*.metadata.json` plus per-key data files (per entity, product, or whatever the primary selector is), so changing the selection fetches only one small file. The exact path and file naming vary per project — pick something sensible under a project-named directory.
- `@tanstack/react-query` with `fetchJson` from `@ourworldindata/utils`. Namespaced query keys (`["my-viz", "data", entityId]`), `placeholderData: (prev) => prev` so the old chart stays visible while switching entities (drive the spinner from `isPlaceholderData` + `useDelayedLoading`), and `staleTime: Infinity` — the files are immutable within a session.
- Data files are usually column-oriented parallel arrays; reshape into rows/Maps client-side, resolving IDs through the metadata. A small metadata class with lazily-built lookup maps (see `causes-of-death/src/core/CausesOfDeathMetadata.ts`) keeps this tidy.
- Defensive code (clamps, dedupes, guards) hides data anomalies from the screen — say what you worked around, so the upstream fix stays actionable.

## 9. State management — decision guide

- **Plain `useState`** — the default for anything not shareable.
- **`useUrlState` (nuqs)** — for state that should be deep-linkable (selected country, year, view). Namespace the query keys with a project prefix (`causesOfDeathRegion`, `migrationYear`) since multiple components share one article URL. Always gate behind the `urlSync` config flag — the hook falls back to `useState` when disabled. Requires `<NuqsAdapter>` (from `nuqs/adapters/react`) at the top of the variant tree. Gating matters on a featured viz page too, where only the featured viz gets the flag. A second instance of the same bundle further down the page keeps local state, so never assume yours is the only one or that the URL is yours to own.
- **jotai module-scope atoms** — only for **cross-variant shared state** (a map in one article block driving a chart in another). Don't add it for a single-variant project.
- **React context** — for small render-scoped things like `{ isMobile }` that many descendants need.
- **Hand-rolled URL encoding** (`queryParamsToStr` + `history.replaceState`) — only when the state doesn't fit query-param-per-value (demography's diff-encoded assumption curves pushed it to hand-roll all of its URL state).

Instantiate the `QueryClient` once at module scope.

## 10. Responsiveness

- Measure your own container — never assume a width, the article grid gives you 6/8/12 columns depending on the block's `size`. For a chart that fills the space it's given, wrap it in `ResponsiveContainer` (`bespoke/components/`): it takes a render prop, hands down the measured `{ width, height }`, and renders nothing until both are non-zero. For other needs there are hooks: `useContainerWidth` (width only, of self or parent — for variant-level breakpoints) and `useChartDimensions` (aspect-ratio-driven height).
- Breakpoints are **JS-driven off the container width** (e.g. `const isNarrow = width < 550` — thresholds vary per project), pushed down via context or props, and can change more than fonts: causes-of-death switches tiling algorithms, the Sankeys switch to stacked layout and short number formats. SCSS `sm-only` media queries complement this for text/controls.
- Guard against zero-size first renders: ResizeObserver can fire before layout, so bail out unless `width > 0 && height > 0` (`ResponsiveContainer` does this for you; measuring by hand doesn't).

## 11. When to extract into shared code — and when not to

Bespoke projects are **one-off, standalone by design**, so the default is project-local. Extract into `bespoke/components/`, `bespoke/hooks/` or `bespoke/helpers/` only when a **second project actually needs it** (the second concrete use, not anticipation) and the piece is **generic and presentational** — props, callbacks and data types, no project-specific data assumptions, no fetching. Compare shared `SplitFlowSankey` with project-local `MigrationSankey` (knows about sexes, years, migration metadata): the domain-aware wrapper always stays in the project. Chart chrome and controls (`Frame`, `ChartHeader`, `Controls`, `TimeSlider`, `Switcher`) are the exception — small, stable, wanted by everyone.

Keep it local when only one project uses it (copying it later is cheaper than a shared abstraction nobody else uses), when it encodes domain logic, data shapes or copy, or when sharing would need a `mode` flag to cover diverging needs — that's two components, not one.

Shared components follow the library conventions: class names only (consumer imports the `.scss` partial), OWID SCSS variables, no data fetching, exported prop types.
