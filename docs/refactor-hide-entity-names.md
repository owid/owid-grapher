# Plan: Split `hideLegend` into `hideLegend` / `hideEntityNames`

## Problem

`hideLegend` controls two visually and semantically different things:

- **Inline entity-name annotations** — floating text labels at the end of lines/slopes/areas.
  These are not a traditional legend; they are series endpoint labels.
- **Categorical color legend boxes** — the color swatches in stacked bar and stacked discrete bar charts.

This conflation causes a real bug: an author setting `hideLegend: true` on a line chart (to hide
endpoint labels) propagates `showLegend: false` to the map tab, silencing the map's color scale.

## What changes and what stays

| Chart type              | Before                                                   | After                                   |
| ----------------------- | -------------------------------------------------------- | --------------------------------------- |
| LineChart               | `hideLegend` hides endpoint labels                       | `hideEntityNames` hides endpoint labels |
| SlopeChart              | `hideLegend` hides endpoint labels                       | `hideEntityNames` hides endpoint labels |
| StackedAreaChart        | `hideLegend` hides endpoint labels                       | `hideEntityNames` hides endpoint labels |
| StackedDiscreteBarChart | `hideLegend` hides categorical legend                    | unchanged                               |
| StackedBarChart         | `hideLegend` hides categorical legend (no editor toggle) | unchanged                               |
| DiscreteBarChart        | `hideLegend` hides color scale (no editor toggle)        | unchanged                               |
| MapChart                | `hideLegend` accidentally hides map legend (bug)         | no longer affected — bug fixed          |
| ScatterPlotChart        | `hideLegend` has no effect                               | unchanged                               |
| MarimekkoChart          | `hideLegend` has no effect                               | unchanged                               |

`isDisplayedAlongsideComplementaryTable` is not touched in this plan.

---

## Step 1: Schema

No version bump required — adding a new optional field is a non-breaking change.

Add to `grapher-schema.009.yaml`:

```yaml
hideEntityNames:
    type: boolean
    default: false
    description: |
        Whether to hide the inline entity name labels drawn at the end
        of each series. Applies to line, slope, and stacked area charts.
```

Update the `hideLegend` description to reflect its narrowed scope:

```yaml
hideLegend:
    type: boolean
    default: false
    description: |
        Whether to hide the categorical color legend. Applies to
        stacked bar and stacked discrete bar charts.
```

---

## Step 2: Types

**`GrapherTypes.ts` (`GrapherInterface`):**

- Add `hideEntityNames?: boolean`
- Add `"hideEntityNames"` to `grapherKeysToSerialize`

**`ChartManager.ts`:**

- Add `showEntityNames?: boolean` alongside the existing `showLegend?: boolean`

---

## Step 3: GrapherState

Add the `hideEntityNames` observable (field declaration + `makeObservable` entry, following the
existing pattern for `hideLegend`).

Add the `showEntityNames` computed:

```typescript
@computed get showEntityNames(): boolean {
    return !this.hideEntityNames
}
```

`showLegend` is unchanged — its meaning is now explicitly scoped to categorical color legends in
stacked/bar charts.

---

## Step 4: Per-chart changes

### LineChart

Switch all `manager.showLegend` reads that control **entity name labels** to `manager.showEntityNames`:

- The `lineLegendWidth` computation (returns 0 when labels are hidden)
- The `LineLegend` render guard
- The fallback to empty-string label (used for layout even when not rendered)
- The right-side padding calculation

Keep `manager.showLegend` for the **horizontal numeric color scale** (a genuine legend, only present
when the chart has a color dimension — this is correctly scoped to `showLegend`).

`externalLegend`: change the trigger condition from `!this.manager.showLegend` to
`!this.manager.showEntityNames`. The categorical bins it exposes are entity names, so the correct
signal is `showEntityNames`.

### SlopeChart

Switch all `manager.showLegend` reads to `manager.showEntityNames`:

- `lineLegendMaxLevelLeft` (returns 0 when labels hidden)
- `showSeriesName` flag passed to individual slope series
- The right-side LineLegend render

`externalLegend`: change trigger from `!this.manager.showLegend` to `!this.manager.showEntityNames`.

### StackedAreaChart

The local `showLegend` computed currently reads:

```typescript
!!this.manager.showLegend &&
    !this.manager.isDisplayedAlongsideComplementaryTable
```

Change the `manager.showLegend` part to `manager.showEntityNames`
(the `isDisplayedAlongsideComplementaryTable` condition stays — it is removed in the follow-up plan):

```typescript
!!this.manager.showEntityNames &&
    !this.manager.isDisplayedAlongsideComplementaryTable
```

`externalLegend`: already gated on the local `showLegend`, which now uses `showEntityNames` — no
further change needed.

### StackedBarChart, StackedDiscreteBarChart, DiscreteBarChart

No changes. Their `showLegend` reads remain on `manager.showLegend`, which is the correct property
for categorical color legends.

### MapChart

No changes. The bug is resolved indirectly: after the migration (step 7), no line/slope/area chart
will have `hideLegend: true` in its config, so `showLegend` will no longer be `false` because of
a line-chart author's intent. The map legend continues to read `manager.showLegend` and the facet
machinery (`FacetMap` passing `showLegend: false` to individual facets) continues to work unchanged.

### FacetChart

Add `showEntityNames: false` to the child manager objects constructed in `intermediatePlacedSeries`,
alongside the existing `showLegend: false` (via `hideFacetLegends`). Without this, line/slope/area
facets would still render endpoint labels, since they now read `showEntityNames` rather than
`showLegend`.

### ScatterPlotChart, MarimekkoChart

No changes.

---

## Step 5: Admin editor

**`EditorFeatures.ts`:** Split the single `hideLegend` computed into two, keeping the same chart
types as before — no behavioural changes, just a structural split:

```typescript
@computed get hideEntityNames() {
    return (
        this.grapherState.isLineChart ||
        this.grapherState.isSlopeChart ||
        this.grapherState.isStackedArea
    )
}

@computed get hideLegend() {
    return this.grapherState.isStackedDiscreteBar
}
```

**`EditorCustomizeTab.tsx`:** Replace the single `hideLegend` toggle with two separate toggles:

- Show `hideEntityNames` toggle (label: "Hide entity name labels") when `features.hideEntityNames`
- Show `hideLegend` toggle (label: "Hide legend") when `features.hideLegend`

---

## Step 6: DB migration

For charts with `hideLegend: true` in their config, remap based on the primary chart type
(`chartTypes[0]`, or the legacy `chartType` field if present):

| Primary chart type                       | Action                                           |
| ---------------------------------------- | ------------------------------------------------ |
| LineChart, SlopeChart, StackedArea       | Set `hideEntityNames: true`, remove `hideLegend` |
| StackedDiscreteBar, StackedBar           | Keep `hideLegend: true` — no change              |
| ScatterPlot, Marimekko, DiscreteBar, Map | Remove `hideLegend` — it had no effect           |

---

## Step 7: Tests and type-checking

- Update any tests that construct chart managers with `showLegend` for line/slope/area charts to use
  `showEntityNames` instead
- Run `yarn typecheck` — `showEntityNames` being required/optional in `ChartManager` will surface
  any missed call sites
- Check that `FacetChart` tests still pass with the new `showEntityNames: false` in child managers
