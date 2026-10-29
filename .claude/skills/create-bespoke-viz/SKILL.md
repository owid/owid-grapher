---
name: create-bespoke-viz
description: Create or extend a bespoke data viz project under bespoke/projects/ — self-contained, Shadow-DOM-embedded visualizations for OWID articles. Use when scaffolding a new bespoke project, building its layout/controls, choosing shared components, or deciding what to reuse from the grapher packages.
metadata:
    internal: true
---

# Creating Bespoke Data Viz

Bespoke projects are one-off, self-contained visualizations embedded in OWID articles via Shadow DOM. A project can also be the subject of its own `featured-viz` page.

[bespoke/readme.md](../../../bespoke/readme.md) is the authoritative doc for the mount interface, Shadow DOM mechanics, ArchieML embedding, featured viz pages, sizing, and jotai-based cross-variant state. Read it first.

Then read the code: list `bespoke/projects/` and skim the one or two closest in shape to what you're building. They are the best blueprint for current conventions, so where one diverges from the references below, the newer project wins. `example` is the minimal starter template, maintained to be copied rather than shipped.

## References

Read the ones the task touches:

- [scaffolding.md](references/scaffolding.md) — new project setup, ArchieML config parsing
- [structure.md](references/structure.md) — file layout, the three variant layers, controls/title/loading conventions, responsiveness
- [reuse.md](references/reuse.md) — shared bespoke code, the grapher packages, and when a piece earns extraction
- [styling.md](references/styling.md) — OWID palettes, stylesheets, portal gotchas
- [tooltips.md](references/tooltips.md) — data tooltips on Grapher primitives, UI tooltips via Tippy, touch behaviour
- [data-and-state.md](references/data-and-state.md) — runtime data fetching, react-query, and where state lives

## Checks

Run `yarn typecheck` and `yarn test` from `bespoke/`, and check the result on the demo page. Pure helpers with real logic (layout algorithms, models, bucketing) get vitest tests next to the source.
