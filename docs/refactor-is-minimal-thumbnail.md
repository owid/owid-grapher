# Plan: Centralize `isDisplayedAlongsideComplementaryTable`

**Prerequisite:** The `hideLegend`/`hideSeriesLabels` split is complete. `showSeriesLabels`,
`showLegend`, and their respective computed properties exist in `GrapherState`.

## Problem

`isDisplayedAlongsideComplementaryTable` is a runtime infrastructure flag set by the thumbnail
generation pipeline (via the `imMinimal` URL param). It has leaked into ~14 chart components, each
of which independently interprets what "minimal mode" means for itself.

The goal: this flag lives only in `GrapherState` and produces nearly all its effects through the
semantic properties that chart components already read (`showSeriesLabels`, `showLegend`). Chart
components become structurally unaware of it, with one exception: `ScatterPlotChart` reads it to
special-case the size legend (see step 4).

There is also a naming issue: the name `isDisplayedAlongsideComplementaryTable` describes the
context in which minimal mode is triggered (a chart shown next to a data table in search results),
not the flag's actual role. `isMinimalThumbnail` is clearer.

---

## Step 1: Rename

Rename `isDisplayedAlongsideComplementaryTable` → `isMinimalThumbnail` everywhere. This is a
purely mechanical find-and-replace that can be done as a standalone commit before any other changes:

- `GrapherState.tsx` — observable field declaration and `makeObservable` entry
- `Grapher.tsx` — `GrapherProgrammaticInterface`
- `functions/_common/imageOptions.ts` — the two sites that set it from the `imMinimal` param
- `functions/_common/explorerHandlers.ts`

---

## Step 2: Centralize effects in GrapherState

Fold `isMinimalThumbnail` into the computed properties from the prerequisite plan. Chart components
will never need to know about `isMinimalThumbnail` because the properties they read encode it:

```typescript
@computed get showSeriesLabels(): boolean {
    if (this.isMinimalThumbnail) return false
    return !this.hideSeriesLabels
}

@computed get showLegend(): boolean {
    if (this.isMinimalThumbnail) return false
    // existing logic: stacked bar special case, then !this.hideLegend
}
```

After this step, any chart component that only reads `showSeriesLabels` or `showLegend` will
automatically behave correctly in minimal-thumbnail mode without knowing about `isMinimalThumbnail`.

---

## Step 3: Remove `isMinimalThumbnail` from `ChartManager`

Remove `isMinimalThumbnail` (currently `isDisplayedAlongsideComplementaryTable`) from the
`ChartManager` interface. `isMinimalThumbnail` remains as an observable on `GrapherState` (where
the thumbnail infrastructure sets it), but is not part of the general manager interface.

`ScatterPlotChart` is the one exception: it needs direct access to `isMinimalThumbnail` to
special-case the size legend (see step 4). Add `isMinimalThumbnail` to `ScatterPlotManager` only.

After this step, the compiler will surface every remaining direct read of `isMinimalThumbnail` in a
chart component (other than ScatterPlotChart) as an error, making cleanup exhaustive by
construction.

---

## Step 4: Per-component cleanup

Work through the compiler errors from step 3.

### Stacked charts: `StackedAreaChart`, `StackedBarChart`, `StackedDiscreteBarChart`

Remove the `&& !this.manager.isDisplayedAlongsideComplementaryTable` condition from their local
`showLegend` computeds. After step 2, `manager.showLegend` and `manager.showSeriesLabels` already
return `false` in minimal-thumbnail mode, making this condition redundant.

### `LineChart`

Remove `!this.manager.isDisplayedAlongsideComplementaryTable` from `hasColorLegend`. `manager.showLegend`
already covers it.

### `DiscreteBarChart`

Remove `!this.manager.isDisplayedAlongsideComplementaryTable` from `showColorLegend`. Same reason.

### `MarimekkoChart`

The local `showLegend` currently reads only `isDisplayedAlongsideComplementaryTable` and ignores
`manager.showLegend` entirely. Replace it with `manager.showLegend`, which now incorporates
minimal-thumbnail suppression:

```typescript
// Before
@computed private get showLegend(): boolean {
    return (
        (!!this.colorColumnSlug || this.categoricalLegendData.length > 1) &&
        !this.manager.isDisplayedAlongsideComplementaryTable
    )
}

// After
@computed private get showLegend(): boolean {
    return (
        (!!this.colorColumnSlug || this.categoricalLegendData.length > 1) &&
        !!this.manager.showLegend
    )
}
```

### `MapChart`

The two legend computeds (`categoryLegend`, `numericLegend`) each have an early return guarded by
`isDisplayedAlongsideComplementaryTable`. They also check `manager.hideMapLegend` (a map-specific
opt-out, independent of `showLegend`). Replace the `isDisplayedAlongsideComplementaryTable` early
return with a `showLegend` check — do not just remove it, because `hideMapLegend` alone would not
suppress legends in minimal-thumbnail mode:

```typescript
// Before
if (this.manager.isDisplayedAlongsideComplementaryTable) return undefined
return !this.manager.hideMapLegend && this.categoricalLegendData.length > 1
    ? new HorizontalCategoricalColorLegend({ manager: this })
    : undefined

// After
return !this.manager.hideMapLegend &&
    !!this.manager.showLegend &&
    this.categoricalLegendData.length > 1
    ? new HorizontalCategoricalColorLegend({ manager: this })
    : undefined
```

Same pattern for `numericLegend`.

### Thumbnail components

`LineChartThumbnail`, `SlopeChartThumbnail`, `StackedAreaChartThumbnail`, `StackedBarChartThumbnail`
all read `isDisplayedAlongsideComplementaryTable` to decide whether to show entity name labels or
categorical legend labels. Replace with the appropriate semantic property:

- Series labels → `manager.showSeriesLabels`
- Categorical legend labels → `manager.showLegend`

### `MarimekkoChartThumbnail`

This is the one case where `isDisplayedAlongsideComplementaryTable` was read with **inverted** logic
— the thumbnail shows its vertical axis _when_ in minimal mode (because the axis substitutes for the
hidden legend). After the refactor this becomes self-evident:

```typescript
// Before
@computed private get shouldShowVerticalAxis(): boolean {
    return !!this.manager.isDisplayedAlongsideComplementaryTable
}

// After
@computed private get shouldShowVerticalAxis(): boolean {
    return !this.manager.showLegend
}
```

"Show axis when legend is hidden" — no thumbnail concept in sight.

### `ScatterPlotChart`

The scatter chart currently does not use `showLegend` from the manager at all — all three sidebar
legends are gated by `isDisplayedAlongsideComplementaryTable`. Replace with `showLegend` as the
uniform gate, then special-case the size legend:

**`verticalColorLegend`** (categorical entity-color sidebar): gate on `!this.manager.showLegend`.
In minimal-thumbnail mode `showLegend` is `false`, so this legend is hidden.

**`arrowLegend`** (connected-scatter time-range arrow): gate on `!this.manager.showLegend`.
Same — hidden when `showLegend` is `false`.

**`sizeLegend`** (bubble-size reference): gate on `!this.manager.showLegend`, but override to show
it in minimal-thumbnail mode because it provides essential interpretive context:

```typescript
// sizeLegend is visible when legends are generally shown,
// OR when in minimal-thumbnail mode (essential context for thumbnails)
if (!this.manager.showLegend && !this.manager.isMinimalThumbnail)
    return undefined
```

This is the one place where a chart component reads `isMinimalThumbnail` directly. The flag is
added to `ScatterPlotManager` (not `ChartManager`) to keep the exception scoped.

### `FacetChart`

FacetChart's `showLegend` computed has its own legend logic (based on `hasBins`, `isNumericLegend`,
facet strategy, etc.) and does not read `manager.showLegend`. Replace the
`isDisplayedAlongsideComplementaryTable` early return with a `showLegend` check — do not just remove
it, or legends would remain visible in minimal-thumbnail mode:

```typescript
// Before
if (this.manager.isDisplayedAlongsideComplementaryTable) return false

// After
if (!this.manager.showLegend) return false
```

---

## Step 5: Verify completeness

After steps 3 and 4 there should be zero references to `isDisplayedAlongsideComplementaryTable`
anywhere. References to `isMinimalThumbnail` should be limited to:

- `GrapherState.tsx` — the observable declaration and `makeObservable` entry
- `Grapher.tsx` — the `GrapherProgrammaticInterface` field
- `ScatterPlotChart.tsx` — the size legend special case (reads from `ScatterPlotManager`)
- `functions/_common/imageOptions.ts` and `explorerHandlers.ts` — the setters

---

## Result: the full data flow

After both plans are complete, the data flow for any legend-related decision in any chart component is:

```
Author config (DB, serialized):
  hideSeriesLabels ──┐
                     ├──► GrapherState.showSeriesLabels ──► LineChart, SlopeChart,
                     │                                      StackedAreaChart
  hideLegend ────────┼──► GrapherState.showLegend       ──► StackedBar, StackedDiscreteBar,
                     │                                      DiscreteBar, Marimekko, MapChart,
                     │                                      ScatterPlot (all three legends)
Runtime only (never serialized):
  isMinimalThumbnail ──► feeds into both showSeriesLabels and showLegend (via GrapherState)
                     ──► ScatterPlot reads directly for size legend override (via ScatterPlotManager)

Facet runtime override (child manager objects, programmatic):
  showLegend: false, showSeriesLabels: false   (set in FacetChart / FacetMap)
```

No chart component reads `isMinimalThumbnail` directly except `ScatterPlotChart` (size legend).
No chart component reads `hideSeriesLabels` or `hideLegend` directly.
