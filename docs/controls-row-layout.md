# Plan: refactor the controls row layout

The plan for replacing the controls row's hardcoded responsive breakpoints
with a layout system that _guarantees_ labels, buttons, and tabs never
overlap — at any width, for any chart configuration. Phases 1–3 are
implemented (branch `controls-row-layout`); the rest are future steps.

Relevant code lives in
`packages/@ourworldindata/grapher/src/controls/controlsRow/`:

- `controlsRowLayout.ts` — the layout ladder + per-tab width composition
- `controlsRowConstants.ts` — sizing constants, `measureButtonWidth`, and
  the derived CSS custom properties; text is measured with the shared
  `textWidth` from `ChartUtils`, which honors `FontSettings.letterSpacing`
- `ControlsRow.tsx` — computes the layout and passes it to the controls

Each control estimates its own width in a `static estimateWidth(...)` next
to its `static shouldShow(...)` (returns 0 when hidden, takes the
component's own render props).

## Motivation

The controls row (Chart/Map/Table tabs on the left; entity selector,
settings, map and table controls on the right) used to collapse labels via
five hardcoded container-query breakpoints (335, 500, 575, 675, 725px) plus
a JS-driven `.GrapherComponentSemiNarrow` class that partially overlapped
with them. The thresholds were tuned by hand for the _default_ labels only,
so anything off the default path could silently overflow the row:

- custom `entityType` / `entityTypePlural` strings (configurable per chart)
- the map tab's state-dependent button set (zoom/reset buttons come and go)
- any newly added control (each one meant re-tuning magic numbers)

Kicked off by [#6399](https://github.com/owid/owid-grapher/issues/6399)
(the truncated "Edit" button on mobile), which made it clear the label
collapsing needed to be content-aware, not breakpoint-based.

## Goal

One invariant, checked in JS against the actual content:

```
tabsWidth(layout) + rowGap + controlsWidth(layout) ≤ maxWidth
```

The row renders the most verbose layout that satisfies it.

## Alternatives considered

- **A. JS width estimation (chosen).** Compute each control's width from
  font metrics (`Bounds.forText`) + sizing constants; pick a layout that
  fits. Precedent: `ActionButtons` does exactly this for the footer.
  Deterministic on first paint, reactive via MobX computeds, no extra DOM.
- **B. Real DOM measurement** (ResizeObserver / offscreen render).
  Pixel-exact, but extra renders, first-paint flicker, and the most
  machinery. Kept as fallback if font metrics ever prove too rough.
- **B′. Canvas `measureText`** — like A but measuring with the real loaded
  font. Possible incremental upgrade, see future steps.
- **C. Pure CSS** (flex-wrap / ellipsis / parameterized container queries).
  Wrap fights grapher's JS-computed vertical layout; ellipsis was rejected
  in #6399; container queries can't read custom properties.
- **D. Overflow ("priority+") menu.** Controls that don't fit move into a
  `⋯` menu. Needs A or B anyway to decide what overflows; kept as a
  possible final rung, see future steps.
- **E. Restructure the row on mobile.** A redesign, not a refactor.

## The design

1. **Measure.** Every control estimates its own width in a
   `static estimateWidth(manager, props)` co-located with its render method
   (and its `shouldShow` — it returns 0 when the control is hidden). The
   options parameter is the component's own render props, so measure-inputs
   equal render-inputs by construction. `controlsRowLayout.ts` only composes
   these estimates per tab, mirroring `ControlsRow`'s render methods.
2. **Pick a layout.** `CONTROLS_ROW_LAYOUT_LADDER` lists configurations
   from most to least verbose; each rung drops the least important
   remaining piece, mirroring the order the old breakpoints implied:

    | rung | change                             |
    | ---- | ---------------------------------- |
    | 0    | everything full, tab padding 16px  |
    | 1    | tab padding 16 → 12px              |
    | 2    | entity name dropped ("Edit")       |
    | 3    | settings label dropped (icon only) |
    | 4    | tab labels dropped (icons only)    |
    | 5    | tab padding 12 → 8px               |

    `chooseControlsRowLayout` returns the first rung that fits the width
    budget (`maxWidth` from `CaptionedChart`) with a `SAFETY_MARGIN` for
    text-measurement error; if nothing fits, the last rung renders.

3. **Render.** `ControlsRow` passes the chosen layout as props
   (`showEntityLabel`, `showLabel`, `showTabLabels`, `tabPadding`); the
   controls render exactly the chosen label — no hidden DOM variants, no
   CSS breakpoints.

All of it is MobX `@computed` state, so the layout is correct on first
paint and reacts to resizes, fullscreen, and map-state changes.

## Phase 1: pure refactor — ✅ done (`3f57814`)

- New `controlsRowLayout.ts` with the measurement + ladder.
- Label derivation extracted into pure functions shared by measurer and
  renderer.
- Props plumbed from `ControlsRow` into `EntitySelectionToggle`,
  `SettingsMenu`, `ContentSwitchers`.
- All five container-query breakpoints and the `.GrapherComponentSemiNarrow`
  label rules deleted from `Controls.scss` (resolving its old TODO);
  replaced by an `.icon-only` button modifier and a
  `ContentSwitchers--icons-only` class.
- Unit tests for the ladder (monotonicity, chosen layout always fits,
  verbosity degrades with width, longer entity names collapse earlier);
  since removed.
- Deliberately no new features: entity labels only know "full" and
  "action only" (see future steps for #6399).

Intended behavior shift: labels collapse when they actually stop fitting,
which is later than the old conservative breakpoints (e.g. the default
chart keeps its full entity label down to ~540px frame width instead
of 675px).

## Phase 2: single-source constants via CSS custom properties — ✅ done (`11baa91`)

The sizing constants started as TS copies of stylesheet values, synced by
comment. Now `controlsRowConstants.ts` is the single source of truth:
`ControlsRow` injects every constant as a CSS custom property on
`nav.controlsRow`, and the stylesheets consume them via `var(...)` with
fallback values, so the styles degrade gracefully if a rule ever applies
outside the injection scope. The fallbacks duplicate the constants and are
kept in sync by hand — when changing a constant, update the corresponding
fallback(s).

Special cases to be aware of:

- **Portals.** The tabs' overflow menu renders into a popover portal
  outside `nav.controlsRow`, so `ContentSwitchers` injects the tab-content
  variables (`TAB_CONTENT_CSS_VARIABLES`) on the popover separately. Any
  new rule that reads an injected variable and matches portaled content
  needs the same treatment.
- **Icon widths are pinned.** FontAwesome icons have intrinsic per-icon
  widths; the stylesheets pin them to `--button-icon-width` /
  `--tab-icon-width` so the estimate is exact rather than a guess (SVGs
  letterbox rather than distort).
- **Generic slim tabs.** `Tabs.scss` keeps its own `--tab-padding` /
  `--tabs-font-size` defaults because the slim `Tabs` variant is also used
  outside the controls row (e.g. `DownloadModal`); the row always overrides
  them via injection.
- **`SAFETY_MARGIN` is the one TS-only value.** Slack for `Bounds.forText`'s
  character-table approximation; it has no CSS meaning.

### Known limits

- Injection synchronizes **values, not structure**. The composition
  functions in `controlsRowLayout.ts` mirror `ControlsRow`'s `render*`
  methods (which controls render on which tab, gaps between them,
  single-line row) — when adding a control, give it an `estimateWidth`
  static and add it to the matching `measure*ControlsWidth` function.
- Dropdowns are measured at their flex-basis although `flex: 0 1 <basis>`
  lets them shrink; the estimate is conservative (labels collapse slightly
  before they strictly must, never too late).
- `Bounds.forText` approximates Lato metrics and treats weight 500 like 400
  (its bold threshold is 600) — hence the safety margin.

## Phase 3: co-locate per-control measurement — ✅ done

Phase 1 put all width estimation in one central file, which required
exporting pure label helpers (`getEntitySelectionLabel`, `getVisibleTabs`)
solely for the measurer and left each control's estimate far from the
render it mirrors. Now each control owns a `static estimateWidth(...)`
beside its `shouldShow` and render:

- Convention: returns 0 when the control wouldn't render; the options
  parameter is typed against the component's own props (e.g.
  `Required<Pick<SettingsMenuProps, "showLabel">>`), never against
  `ControlsRowLayout` — that would create an import cycle.
- Labels used by both render and measure ("Settings", "Reset zoom",
  "Zoom to selection") are defined once per component.
- `measureButtonWidth` lives in `controlsRowConstants.ts` — it interprets
  the shared button style, not any single component, and it can't live in
  `controlsRowLayout.ts` because the components that call it are imported
  there (cycle). Text is measured with `textWidth` from `ChartUtils`,
  extended to honor an optional `FontSettings.letterSpacing` (in em);
  `BUTTON_FONT` / `TAB_FONT` carry it so call sites can't forget the
  spacing.
- `controlsRowLayout.ts` shrank to the layout policy: the ladder, the
  chooser, and the per-tab composition functions that mirror `ControlsRow`'s
  render methods (cross-referenced by comments in both directions).

This fixes _per-control_ drift (editing a control's render puts its
estimate on screen); _composition_ drift (adding a control to a tab without
adding it to that tab's `measure*` function) still relies on the mirror
comments — a dev-mode estimated-vs-actual width assertion would be the
structural guard, see future steps.

## Future steps

Roughly in priority order:

1. **Verify on staging.** So far only verified with typecheck and lint.
   Check chart/map/table tabs across widths (especially
   320–730px and charts with custom entity types); confirm nothing overlaps
   and the collapse order feels right. Tune `SAFETY_MARGIN` if labels sit
   too tight or collapse too eagerly.
2. **Short entity names ([#6399](https://github.com/owid/owid-grapher/issues/6399)).**
   Add a rung between "full entity label" and "action only" that renders
   "Edit countries" for the default "Edit countries and regions" (and
   "Change country" for "country or region"). With the ladder in place this
   is an `entityShort` derivation, one extra ladder rung, and a render
   branch in `EntitySelectionToggle`. The map tab's "Select countries" is
   already short and could stay visible on narrow screens the same way.
3. **Fold the table tab's filter dropdown into the ladder.** It currently
   hides via the unrelated `isSemiNarrow` flag (≤550px frame width) in
   `DataTableFilterDropdown.shouldShow`; a ladder rung ("drop the filter
   dropdown when the row doesn't fit") would replace the last magic
   breakpoint in the row. Careful: `shouldShow` feeds the measurement, so
   the visibility decision must move out of `shouldShow` to avoid a
   circular dependency.
4. **Map buttons at narrow widths.** "Zoom to selection" / "Reset view" /
   "Reset zoom" never collapse today. If the map controls row gets crowded,
   an icon-only rung for them is cheap — needs a design decision first.
5. **Overflow ("priority+") menu.** If the number of chart controls keeps
   growing, dropping controls into a `⋯` menu is the natural final rung —
   the measurement infrastructure to decide what overflows already exists
   (this was option D, and the old `Controls.scss` TODO about a variable
   number of buttons).
6. **Metric upgrades if estimates prove too rough** (option B′): derive
   per-icon widths from the FontAwesome icon definitions
   (`icon.icon[0]/[1]`) instead of one pinned width, and/or replace
   `Bounds.forText` with canvas `measureText` at runtime — grapher's
   controls never render statically, so a browser API is acceptable there.
