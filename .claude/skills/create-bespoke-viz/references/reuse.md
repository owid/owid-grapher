# What to reuse, and what to extract

## Shared bespoke code

Before building a control, tooltip helper, sizing hook, or config/label utility, list `bespoke/components/`, `bespoke/hooks/` and `bespoke/helpers/` and read the signatures of whatever looks relevant. Several do more than their names suggest, so open the file before concluding it's not what you need.

Form controls that `bespoke/components/` lacks often already exist in `@ourworldindata/components` (`Checkbox`, `RadioButton`, `LabeledSwitch`), styled the Grapher way.

Import via deep relative paths with `.js` extensions, not the `@owid/bespoke-components` workspace name that no project depends on: `import { Frame } from "../../../../components/Frame/Frame.js"`. Styles are opt-in — no shared or Grapher component `.tsx` imports its own, so the consumer `@import`s the matching `.scss` partial in `index.scss`, and a missing one surfaces as an unstyled component rather than an error.

`bespoke/shared/` is for code shared with the site rendering and the build (mount types, Shadow-DOM mounting, the dedupe list), not for project utilities.

## Grapher packages

The `@ourworldindata/*` packages are linked in per project (`link:../../../packages/@ourworldindata/<pkg>`), so add the one you need to `package.json` rather than assuming it's there.

Before hand-writing any general-purpose helper — number/date formatting, entity/region names, SVG geometry or text layout, tooltips, controls, color logic — check whether one already exists in those packages.

`bespoke/components/BezierArrow/` is a dev-time debug wrapper with draggable handles for finding offsets; the arrow itself is `BezierArrow` from `@ourworldindata/grapher`.

For third-party utilities, projects lean on `remeda` (imported as `* as R`) and `ts-pattern`'s `match` over hand-rolled loops and switch statements.

## When a piece earns extraction

Bespoke projects are one-off and standalone by design, so the default is project-local. Extract into `bespoke/components/`, `bespoke/hooks/` or `bespoke/helpers/` only when a **second project actually needs it** — the second concrete use, not anticipation — and the piece is generic and presentational: props, callbacks and data types, no project-specific data assumptions, no fetching. Compare shared `SplitFlowSankey` with project-local `MigrationSankey`, which knows about sexes, years and migration metadata: the domain-aware wrapper stays in the project. Chart chrome and controls (`Frame`, `ChartHeader`, `Controls`, `TimeSlider`, `Switcher`) are the exception — small, stable, wanted by everyone.

Keep it local when only one project uses it (copying it later is cheaper than a shared abstraction nobody else uses), when it encodes domain logic, data shapes or copy, or when sharing would need a `mode` flag to cover diverging needs — that's two components, not one.
