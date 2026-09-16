# bespoke/components

Shared React components for bespoke projects. Chart chrome, controls, and the
pieces every project ends up needing.

Alongside it, [bespoke/hooks](../hooks) holds shared hooks and
[bespoke/helpers](../helpers) shared non-visual utilities. List all three before
building a control, a sizing hook or a label utility, and open the file rather
than guessing from the name. Several do more than the name suggests.

## What is here

Chart chrome:

- **Frame.** The bordered card a chart sits in. Renders the metadata modal when the project provides one.
- **ChartHeader.** Title, subtitle and the OWID logo.
- **ChartFooter.** Data source, note, the CC BY link, and the "Learn more about this data" button.
- **ChartSkeleton.** The box that holds a chart's place while its data loads. It takes a `className` and sets no width or height of its own, so the size comes from the project. The spinner is gated behind `useDelayedLoading`, so a warm-cache load shows a quiet box rather than a flash.
- **ChartError.** The box shown when a chart's data fails to load. Takes an optional `message`. There is no retry, so the default copy points a reader at reloading instead.

Controls:

- **Controls**, **ControlsRow**, **LabeledControl.** The controls bar. Harmonized across projects, so compose these rather than restyling per project.
- **LabeledDropdown**, **EntityDropdown.** Dropdowns with a label. `EntityDropdown` adds relevance ordering for entity names.
- **Switcher.** A segmented control.
- **TimeSlider.** The year slider, which sits below the controls row rather than in it.

Everything else:

- **Spinner.** `standalone` overlays its container, dimming the chart beneath while a refetch lands, and needs that container to be `position: relative`. `inline` sits in a line of text.
- **ResponsiveContainer.** Measures its own width, for a chart that fills the space it is given.
- **Sankey.** `SplitFlowSankey` and `BilateralFlowSankey`, plus the layout helpers in `SankeyHelpers.ts`.
- **MetadataModal.** The methods-and-sources modal, its context provider, and the parser for a project's metadata file.
- **BezierArrow.** A dev-time wrapper with draggable handles for finding an arrow's offsets. The arrow itself is `BezierArrow` from `@ourworldindata/grapher`.

## Three things that are not guessable

**There is no barrel.** Import the file directly, with a `.js` extension,
through a deep relative path. From a project's `src/variants/`, that is four
levels up:

```ts
import { ChartSkeleton } from "../../../../components/ChartSkeleton/ChartSkeleton.js"
```

The `@owid/bespoke-components` workspace name does not resolve from a project,
because no project takes it as a dependency.

**Styles are opt-in.** No component imports its own SCSS. Each consuming project
imports the partial it wants in `src/index.scss`:

```scss
@import "../../../components/ChartSkeleton/ChartSkeleton.scss";
```

A missing import shows up as an unstyled component rather than an error, which
is worth knowing when a box turns up with no border.

**A component is styled entirely from its own partial.** Projects run inside a
Shadow DOM, which has no access to the site's global styles. Use `:host`, never
`:root`. The Grapher style partials every project imports in `grapher.scss` are
in scope, so `$frame-color`, `$light-text` and the rest resolve.

## When a piece belongs here

The default for a bespoke project is project-local, and a piece earns a place
here on the second concrete use rather than in anticipation. It has to be
generic and presentational: props, callbacks and data types, no project-specific
data assumptions and no fetching. Chart chrome and controls are the exception,
since they are small, stable and wanted by everyone.

`bespoke/shared/` is a different thing. It holds code shared with the site
rendering and the build, not project utilities.
