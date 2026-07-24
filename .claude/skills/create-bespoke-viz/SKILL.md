---
name: create-bespoke-viz
description: Create or extend a bespoke data viz project under bespoke/projects/ — self-contained, Shadow-DOM-embedded visualizations for OWID articles. Use when scaffolding a new bespoke project, building its layout/controls, choosing shared components, or deciding what to reuse from the grapher packages.
metadata:
    internal: true
---

# Creating Bespoke Data Viz

Bespoke projects are one-off, self-contained visualizations embedded in OWID articles via Shadow DOM. Each project under `bespoke/projects/` has its own `package.json`, dependencies, and Vite build; the output is an ES module exporting a `mount` function. Read [bespoke/readme.md](../../../bespoke/readme.md) first — it is the authoritative doc for the mount interface, Shadow DOM mechanics, ArchieML embedding, and jotai-based cross-variant state. This skill covers the conventions the readme doesn't: project scaffolding, layout, shared components, and what to reuse from the grapher codebase.

Before starting, **list `bespoke/projects/` and skim the one or two existing projects closest in shape to what you're building** — real projects are the best blueprint for current conventions, and newer ones tend to reflect them best. The `example` project is special: it's the minimal starter template, maintained to be copied rather than shipped. Where the sections below cite a specific project, that's an example of where a pattern lives today, not a canon — prefer newer precedent if it diverges.

## 1. Scaffolding a new project

Start by copying `bespoke/projects/example/` and renaming. The yarn workspace (`bespoke/package.json` has `projects/*`) picks it up automatically — run `yarn install` from `bespoke/`.

Checklist:

1. **`package.json`**: name `@owid/bespoke-<name>`, `"private": true`, `"type": "module"`. Keep the non-standard `entrypoints` field — the dev server and vite config read it:
    ```json
    "entrypoints": {
        "js": "src/index.tsx",
        "dev-only-global-css": "src/dev-only-global-css.css"
    }
    ```
    Scripts are always `"dev": "vite dev"`, `"build": "vite build"`, `"typecheck": "tsc"`. The `@ourworldindata/*` packages are consumed via `link:../../../packages/@ourworldindata/<pkg>` and bundled into the output.
2. **`vite.config.ts`**: copy from `example` verbatim. It has three load-bearing pieces:
    - library mode (`build.lib`, `formats: ["es"]`, entry from `entrypoints.js`),
    - `viteCssPosition({ enableDev: true })` — injects CSS into the Shadow DOM via `<StylesTarget />` (see readme),
    - the SWC decorator plugin wrapped in `withFilter` (the linked grapher package uses MobX decorators).

    **Trap**: `resolve.dedupe` must list every library that has to be a singleton. The linked packages (and the shared `bespoke/components`/`hooks` workspaces) resolve deps against their real paths, so without dedupe you get a second React copy (breaks hooks), a second react-query (breaks the QueryClient context), or a second react-aria (breaks overlays). Baseline is `["react", "react-dom", "@react-stately/flags"]`; existing projects extend it with `"@tanstack/react-query"` and/or the react-aria packages — check the dedupe list (and its comment) in the project closest to yours.

3. **`tsconfig.json`**: copy from `example`. It carries the path alias for the type-only import of the mount contract:
    ```json
    "paths": { "owid-bespoke-types": ["../../shared/bespokeComponentTypes.ts"] }
    ```
4. **`src/index.tsx`** — the mount contract (copy from `example`):
    - call `enableShadowDOM()` from `@react-stately/flags` at module load, before any react-aria component renders;
    - export `VARIANTS` (`satisfies BespokeComponentVariantsList<VariantName>`) — the demo page renders one Shadow-DOM instance per entry, honoring `demoConfig`/`demoSize`;
    - export `mount`: look up the variant, `createRoot(container)`, render `<StylesTarget />` as the first sibling, return `() => root.unmount()`;
    - `import "./index.scss"` at the top.
5. **Register** the bundle in [site/bespokeComponentRegistry.ts](../../../site/bespokeComponentRegistry.ts): `"<name>": { scriptUrl: "/<name>/index.js" }`. URLs resolve against `BESPOKE_BASE_URL` (defaults to the local dev server `http://localhost:8089`).
6. **Dev workflow**: `yarn startBespokeDevServer`, then open `http://localhost:8089/<name>/demo` — every variant mounted in its own Shadow DOM, exactly like production (`--build` serves the production build instead). For embedding in an actual article, the readme has the `{.bespoke-component}` syntax.
7. **Production build**: `bespoke/buildBespokeProjects.sh` builds all projects and collects each `dist/` into `dist/assets-bespoke/<name>/`; the baker copies these into the site. No per-project deploy config needed.

Config parsing: ArchieML config values are always **strings**. Put parsing in a dedicated `src/config.ts` exporting a `parseConfig(raw: Record<string, string>)` with small helpers for booleans/enums/numbers (see `food-trade/src/config.ts`) — this is good practice even though not every project has one yet. Support the conventional keys where they make sense: `title`, `subtitle` (override the generated ones), `hideControls`, `urlSync`, and an entity default (`country` or `region`) that accepts the sentinel `"userLocation"` (resolve it with the `useResolveUserLocation` hook).

## 2. Layout: how a bespoke chart is composed

Every project structures a variant in three layers — follow this naming/altitude convention:

1. `<Name>Variant` — providers (`QueryClientProvider`, `NuqsAdapter`, breakpoint context) plus the width-measuring wrapper div;
2. `Fetching<Name>Variant` — data queries, URL state, and the skeleton / error / empty-state gates;
3. the captioned chart (`Captioned<Name>Variant` / `<Name>CaptionedChart`) — the visual composition below.

For the composition, the standard is two stacked `Frame` cards — a controls card above the captioned chart (diverge when the content calls for it, see below):

```tsx
<div className="my-viz-chart">
    {/* optional controls card, ABOVE the chart */}
    {!config.hideControls && (
        <Frame className="my-viz-controls">
            <h3 className="my-viz-controls__title">Configure the data</h3>
            <div className="my-viz-controls__content">
                <div className="my-viz-controls__row">
                    {/* InlineLabeledDropdown / EntityDropdown / Switcher */}
                </div>
                <div className="my-viz-controls__row">
                    {/* TimeSlider gets its own row */}
                </div>
            </div>
        </Frame>
    )}

    {/* the captioned chart */}
    <Frame className="my-viz-captioned-chart">
        <ChartHeader title={title} subtitle={subtitle} />
        <div className="my-viz-captioned-chart__chart-area">
            {showDelayedSpinner && <Spinner />}
            <MyResponsiveViz {...props} />
        </div>
        <ChartFooter source={metadata.source} note={note} />
    </Frame>
</div>
```

The captioned-chart Frame (header → chart area → footer) is universal, and the controls block is **wrapped in `<Frame>` by default too**. Diverge only when the content calls for it — e.g. migration's unframed controls under a page-level heading, or no controls block at all with the entity selector embedded inline in the title.

Conventions that go with this:

- **Titles are narrative sentences** generated from the current selection ("What did children under 5 in India die from in 2021?"), not static labels. Use `articulateEntity` for grammatical country names. An alternative to a controls bar is embedding the entity selector inline in the title (see demography's `InlineEntitySelector`) — nice when the entity is the only control.
- **Loading UX**: skeleton on first load (a simple box with a `<Spinner />` is enough); on refetch keep the old chart visible (react-query `placeholderData`) with a `<Spinner />` overlay (its container needs `position: relative`); gate spinners behind `useDelayedLoading(isPlaceholderData, 300)` so fast loads don't flash. `<Spinner inline />` works inside text, e.g. a subtitle value that's reloading.
- **Errors**: render a plain fallback div with a message; parse defensively (filter bad rows with a `console.warn`) rather than throwing.
- **Empty states**: when the current selection legitimately has no data, show a "no data" message div (optionally with a button switching to a selection that has data) — a third state, distinct from error and skeleton.

## 3. Shared components (`bespoke/components/`) and hooks (`bespoke/hooks/`)

Before building a control, tooltip helper, or sizing hook, check what already exists: **list `bespoke/components/` and `bespoke/hooks/` for the current inventory** — the names are self-explanatory — and read the prop types / signatures of whatever looks relevant. Every project uses the chart chrome (`Frame`, `ChartHeader`, `ChartFooter`, `Spinner`); beyond that expect controls (dropdowns including a geolocation-aware `EntityDropdown`, a `Switcher`, a `TimeSlider`), a full Sankey toolkit (bilateral and split-flow layouts — don't build a second Sankey), and hooks for container sizing, URL state, delayed loading, geolocation, and touch/Shadow-DOM-aware tooltips.

Entity dropdowns across projects share a **relevance ordering**: pinned aggregates (e.g. World) → current selection → the user's own country/continent marked with a location icon (via `useUserCountryInformation`) → the rest alphabetically. Reuse that pattern (and the `"userLocation"` config sentinel) rather than a flat alphabetical list.

Form controls that `bespoke/components/` lacks often already exist in **`@ourworldindata/components`** (e.g. `Checkbox`, `RadioButton`, `LabeledSwitch`), styled the Grapher way and following the same opt-in convention — import the matching `.scss` partial.

Non-obvious facts about consuming them:

- Import via **deep relative paths with `.js` extensions** (not the workspace package name), e.g. `import { Frame } from "../../../../components/Frame/Frame.js"`. Vite bundles them into your output.
- Styles are **opt-in**: component `.tsx` files never import their own styles — the consumer must `@import` the matching `.scss` partial in `index.scss`, **after** the OWID SCSS variables are in scope (the partials use `$dark-text`, `$frame-color`, etc. without defining them). See §6.
- Hooks built on react-query (e.g. `useUserCountryInformation`) need a `<QueryClientProvider>` in the variant tree.

`bespoke/shared/` is different: it's code shared with the **site rendering code** (mount types, Shadow-DOM mounting, `exportSvg.ts` for the demo page's "Download SVGs" button). Don't add project utilities there.

## 4. Reusing utilities from the grapher codebase

The `@ourworldindata/*` packages (`utils`, `types`, `grapher`, `components`, `core-table`) are linked into every project. **Before hand-writing any general-purpose helper — number/date formatting, entity/region names, SVG geometry or text layout, tooltips, controls, color logic — always check whether one already exists there.** Ways to check:

- skim the package entry points (`packages/@ourworldindata/{utils,grapher,components}/src/index.ts`) for exported symbols, or grep the packages for a likely name;
- see what existing projects already import: `grep -rh "@ourworldindata" bespoke/projects/*/src`.

A non-exhaustive sample of what projects have reused, to give a sense of the breadth: `formatValue` (+ `OwidVariableRoundingMode`) for number formatting; `articulateEntity` and the region helpers (`getRegionByName`, …) for grammatical entity names and region metadata; `Bounds`, `getRelativeMouse`, `isTouchDevice` for SVG geometry and interaction; `Tippy` plus Grapher's `TooltipCard`/`TooltipValue`/`TooltipTable` for tooltips; `TextWrap`/`MarkdownTextWrap`/`Halo` for SVG text; Grapher's `Dropdown` control; `BezierArrow` for annotations (from `@ourworldindata/grapher` — `bespoke/components/BezierArrow/` is just a dev-time debug wrapper with draggable handles for finding offsets); `fetchJson` and URL-param helpers.

For third-party utilities, projects lean on `remeda` (imported as `* as R`) and `ts-pattern`'s `match` — prefer these over hand-rolled loops and switch statements.

Some of these are deep imports (e.g. `@ourworldindata/grapher/src/tooltip/TooltipCard.js`) rather than package-index exports — both are fine. When you deep-import a styled Grapher component, add its `.scss` (e.g. `.../controls/Dropdown.scss`, `.../tooltip/Tooltip.scss`) to your `index.scss`.

## 5. Visual style & colors

Bespoke charts should read as part of the OWID chart family. For the chart furniture — axis ticks and labels, gridlines, annotations, legends — don't design from scratch: look at how a similar existing project (or Grapher itself) styles these and align with it, matching font sizes, weights, and grays.

Default to the OWID palettes — don't invent hex values. The palettes live in `packages/@ourworldindata/grapher/src/color/`; **browse `CustomSchemes.ts`, `ColorConstants.ts`, and `ColorUtils.ts` for the full range** — there is much more than the examples below (continent/energy/income-group colors, map palettes, single-color gradients, …). Commonly used entry points:

- **Categorical series**: `OwidDistinctColors` (`.../color/CustomSchemes.js`) — the named 24-color palette (`.Denim`, `.Maroon`, …).
- **Text & UI grays**: `GRAPHER_LIGHT_TEXT` (the workhorse for secondary text), `GRAPHER_DARK_TEXT`, `GRAY_5`…`GRAY_100` (`.../color/ColorConstants.js`).
- **Helpers** like `isDarkColor`/`darkenColorForText` (`.../color/ColorUtils.js`) for picking legible label colors on colored marks.
- SCSS side: the OWID variables are in scope via `grapher.scss` (§6) — in practice mostly `$dark-text`, `$frame-color`, and the typography stacks.

Hardcoding hex is acceptable only for **semantic, domain-specific colors** with no palette equivalent — e.g. causes-of-death's five category colors or demography's magenta "user-modified" color. Keep those in one constants file with a single accessor (`getCategoryColor(...)`).

## 6. Styling & Shadow DOM

- `src/index.scss` is the single import hub, in this order: `normalize.css` → vendor CSS (Font Awesome's `@fortawesome/fontawesome-svg-core/styles.css`, tippy + its light theme) → `./grapher.scss` (the OWID SCSS partials) → `./base.scss` → your project styles (a single `styles.scss` or per-component partials) → each shared component's `.scss` partial you use. Copy `grapher.scss` from an existing project — it pulls the OWID SCSS partials (colors, variables, typography, mixins) from the `@ourworldindata/components` and `grapher` packages, putting `$sans-serif-font-stack`, `$serif-font-stack`, `$dark-text`, `$gray-*`, and the `sm-only` mixin in scope.
- `base.scss` sets the host font — **use `:host`, not `:root`** inside a Shadow DOM:
    ```scss
    :host {
        font-family: typography.$sans-serif-font-stack;
    }
    ```
- **Fonts**: don't bundle `@font-face` — Lato/Playfair are declared by the host document and `@font-face` is document-scoped, so it works inside the shadow root. Just reference the family names via the SCSS stacks.
- Strict **BEM** with full class names written out (`.my-viz-controls__row`, never `&__row`), per repo convention.
- **Portal gotchas**:
    - Tippy tooltips must portal into the shadow root, not `document.body` — see §7.
    - react-aria dropdown menus portal into the **light DOM** (Enter-to-select is broken in Shadow DOM), so any custom styling inside menu options must be **inline styles** (see the comment in `food-trade`'s controls and `EntityDropdown`'s `LocationIcon`).
    - `dev-only-global-css.css` supplies the global styles those portaled overlays need on the demo page (production articles already have them). Keep this entrypoint.

## 7. Tooltips

Two kinds of tooltips with different tooling — check how existing projects and the shared Sankey component wire them before building your own.

**Data tooltips** (hovering chart marks): build on Grapher's tooltip primitives instead of rolling your own chrome. `TooltipCard` (`@ourworldindata/grapher/src/tooltip/TooltipCard.js`) is the positioned card — `x`/`y`, `offsetX`/`offsetY`, `title`, `subtitle`, `containerBounds`, `anchor` — with `TooltipValue`/`TooltipTable` rows (`.../tooltip/TooltipContents.js`) inside; its `Tooltip.scss` comes in via the copied `grapher.scss` (check it's there). The established wiring:

- Hold a hover state of the target plus a `position`; set it on mark hover and update `position` on mouse move with `getRelativeMouse(svgRef.current, event.nativeEvent)`.
- Pass the chart's `containerBounds` to `TooltipCard` so the card flips/clamps instead of overflowing the chart.
- If the pointer crosses gaps between adjacent marks (e.g. treemap tiles), delay hover-out (~200 ms `setTimeout` before clearing the target, cancelled on re-enter) so the tooltip doesn't flicker; for contiguous marks, clearing immediately on `mouseleave` is fine.
- **Touch devices don't hover.** Use `usePinnedTooltip(isActive, onDismiss)`: on touch it returns `isPinned: true` and owns dismissal (tap outside, chart scrolled out of view) — skip your mouse-leave logic there (`if (isTouchDevice()) return`). When pinned, render the card with `anchor={GrapherTooltipAnchor.Bottom}` (from `@ourworldindata/types`) and **no** `containerBounds`, so it sits fixed at the bottom of the viewport instead of following a cursor that doesn't exist.
- Content conventions: title is the hovered mark/series, subtitle adds context, `TooltipValue` rows take the mark's `color`. Richer content (e.g. inline sparklines) is fine — a tooltip is a regular React subtree.

**UI tooltips** (info icons, the CC BY note, "why is this control disabled"): use `Tippy` from `@ourworldindata/utils`, and always pass `useTippyContainer()`'s `getTippyContainer` as `appendTo` — inside a Shadow DOM, Tippy would otherwise portal to `document.body` where your styles don't reach. Bundle tippy's CSS (and theme) in `index.scss`.

## 8. Data loading

Bespoke data is **fetched at runtime, never bundled**. The established pattern across existing projects:

- Pre-processed JSON hosted on the public bucket `https://owid-public.owid.io` — one small `*.metadata.json` plus per-key data files (per entity, product, or whatever the primary selector is), so changing the selection fetches only one small file. The exact path and file naming vary per project — pick something sensible under a project-named directory.
- `@tanstack/react-query` with `fetchJson` from `@ourworldindata/utils`. Namespaced query keys (`["my-viz", "data", entityId]`), `placeholderData: (prev) => prev` so the old chart stays visible while switching entities (drive the spinner from `isPlaceholderData` + `useDelayedLoading`), and `staleTime: Infinity` — the files are immutable within a session.
- Data files are usually column-oriented parallel arrays; reshape into rows/Maps client-side, resolving IDs through the metadata. A small metadata class with lazily-built lookup maps (see `CausesOfDeathMetadata.ts`) keeps this tidy.
- **Record data anomalies in a `data-issues.md` at the project root as you find them** — what the issue is, its impact on the viz, how the code handles it, and the recommended fix. Defensive code (clamps, dedupes, guards) hides issues from the screen but not from readers of this file — it's what makes upstream fixes actionable later. See `migrant-demographics/data-issues.md` for an example.

## 9. State management — decision guide

- **Plain `useState`** — the default for anything not shareable.
- **`useUrlState` (nuqs)** — for state that should be deep-linkable (selected country, year, view). Namespace the query keys with a project prefix (`causesOfDeathRegion`, `migrationYear`) since multiple components share one article URL. Always gate behind the `urlSync` config flag — the hook falls back to `useState` when disabled. Requires `<NuqsAdapter>` (from `nuqs/adapters/react`) at the top of the variant tree.
- **jotai module-scope atoms** — only for **cross-variant shared state** (a map in one article block driving a chart in another). Don't add it for a single-variant project.
- **React context** — for small render-scoped things like `{ isMobile }` that many descendants need.
- **Hand-rolled URL encoding** (`queryParamsToStr` + `history.replaceState`) — only when the state doesn't fit query-param-per-value (demography's diff-encoded assumption curves pushed it to hand-roll all of its URL state).

Instantiate the `QueryClient` once at module scope.

## 10. Responsiveness

- Measure your own container: `useChartDimensions` (aspect-ratio-driven height) or `useContainerWidth`. Never assume a width — the article grid gives you 6/8/12 columns depending on the block's `size`.
- Breakpoints are **JS-driven off the container width** (e.g. `const isNarrow = width < 550` — thresholds vary per project), pushed down via context or props, and can change more than fonts: causes-of-death switches tiling algorithms, the Sankeys switch to stacked layout and short number formats. SCSS `sm-only` media queries complement this for text/controls.
- Guard against zero-size first renders: ResizeObserver can fire before layout, so bail out unless `width > 0 && height > 0`.

## 11. When to extract into shared code — and when not to

Bespoke projects are **one-off, standalone by design**. The bias is firmly toward keeping code project-local: a dependency-free project can be changed (or deleted) without thinking about anything else, and premature abstractions across one-off projects age badly.

Extract into `bespoke/components/` or `bespoke/hooks/` when:

- **A second project actually needs it** — extraction is triggered by the second concrete use, not by anticipation. The Sankey toolkit was worth sharing because food-trade and migration both needed the same substantial machinery; a second treemap project would justify extracting a generic treemap the same way.
- The extracted piece can be **generic and presentational**: props + callbacks + data types, no project-specific data assumptions, no fetching. Compare shared `SplitFlowSankey` (takes `flows`, `formatValue`, callbacks) with project-local `MigrationSankey` (knows about sexes, years, migration metadata). The domain-aware wrapper always stays in the project.
- It's chart **chrome or a control** with an obvious stable contract (`Frame`, `ChartHeader`, `TimeSlider`, `Switcher`) — these are small, generic, and every project wants them.

Keep it project-local when:

- Only one project uses it, even if it "feels reusable". Copying a hundred lines into a second project later is cheaper than maintaining a shared abstraction nobody else uses.
- It encodes domain logic, data shapes, or copy (metadata classes, config parsing, narrative title builders, category colors).
- Sharing would require config flags to cover diverging needs — if the second consumer needs a `mode` prop to reuse it, it probably isn't one component.

Also don't duplicate what grapher already provides — check §3/§4 before writing a dropdown, tooltip, text-wrapper, or color palette from scratch.

Shared components follow the library conventions: class names only (consumer imports the `.scss` partial), OWID SCSS variables, no data fetching, exported prop types.

## 12. Testing & verification

- Pure helpers with real logic (layout algorithms, models, "Other"-bucketing) get **vitest** unit tests next to the source (see the existing `*.test.ts` files under `bespoke/`). Run from `bespoke/` with `yarn test`.
- `yarn typecheck` from `bespoke/` covers all workspaces; each project also has its own `yarn typecheck`.
- Visual verification happens on the demo page (`http://localhost:8089/<name>/demo`), which mirrors production Shadow-DOM embedding, including per-variant `demoConfig`/`demoSize` and an SVG download button.
