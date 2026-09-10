# Project structure and composition

## Where files go

```
src/
    index.tsx          the mount contract
    index.scss + …     the stylesheets (see styling.md)
    components/        chart pieces, controls, tooltips
    variants/          one file per entry in VARIANTS
    core/              everything non-visual
```

**Everything non-visual lives in `core/`** — config, types, constants, fetching, helpers, hooks, metadata classes, layout algorithms, and their `*.test.ts` files. Nothing but `index.tsx`, the stylesheets and the boilerplate copied from `example` sits at the `src/` root. Split `core/` into subfolders only when one part grows into its own layer (demography's simulation is `core/model/`).

## The three variant layers

`SankeyVariant` (providers plus the width-measuring wrapper) → `FetchingSankeyVariant` (queries, URL state, and the skeleton / error / empty-state gates) → `CaptionedSankeyVariant` (the visual composition). Keep the naming; it's how every project signals altitude.

The composition standard is two stacked cards: a `Controls` box (gated on `!config.hideControls`) above a `Frame` holding `ChartHeader` → chart area → `ChartFooter`. A project with a metadata file wraps that `Frame` in `BespokeMetadataProvider`, which adds a "Learn more about this data" link to the footer and puts the `MetadataModal` inside the frame; it switches both off when the embedding page sets `hideMetadataModal`, as a featured viz page does.

## Controls

Controls are harmonized across all bespoke projects — compose `Controls`/`ControlsRow`/`LabeledControl` and don't restyle them per project. Every dropdown and switcher carries a label; a checkbox labels itself and the time slider takes none, and the time slider sits below the row rather than in it. `migration/src/components/MigrationControls.tsx` is a full example.

## Titles

Titles are narrative sentences generated from the current selection ("What did children under 5 in India die from in 2021?"), not static labels. Format entity names for a sentence with `bespoke/helpers/entityNames.ts`. When the entity is the only control, embedding the selector inline in the title beats a controls bar — demography's `InlineEntitySelector`.

## Loading, errors, empty states

- **Loading**: skeleton on first load (a box with a `<Spinner />` is enough); on refetch keep the old chart visible with a `<Spinner />` overlay, whose container needs `position: relative`. Gate spinners behind `useDelayedLoading` so fast loads don't flash. `<Spinner inline />` works inside text, e.g. a subtitle value that's reloading.
- **Errors**: render a plain fallback div with a message; parse defensively (filter bad rows with a `console.warn`) rather than throwing.
- **Empty states**: when the current selection legitimately has no data, show a "no data" message — a third state, distinct from error and skeleton — optionally with a button switching to a selection that has data.

## Responsiveness

Measure your own container; `ResponsiveContainer` (`bespoke/components/`) does it for a chart that fills the space it's given, and `useContainerWidth` / `useChartDimensions` cover the rest. Measuring by hand needs a `width > 0 && height > 0` guard, since ResizeObserver can fire before layout.

Breakpoints are JS-driven off the container width (e.g. `const isNarrow = width < 550`, thresholds vary per project) and can change more than fonts: causes-of-death switches tiling algorithms, the Sankeys switch to stacked layout and short number formats.
