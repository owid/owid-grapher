# Plan: `map` dimension property

_Re: [#6451](https://github.com/owid/owid-grapher/issues/6451) (allow arbitrary
indicator for the map tab). Predecessor:
[#5061](https://github.com/owid/owid-grapher/issues/5061) (computed sum on map
tabs), closed in favor of this._

## Problem

The map tab can only show one of the chart's plotted dimensions:
`GrapherState.mapColumnSlug` falls back to the first y-column whenever
`map.columnSlug` doesn't match a dimension, and the admin's map-tab indicator
dropdown (`adminSiteClient/EditorMapTab.tsx`) only offers `filledDimensions`.
For multi-indicator charts, authors often want the map to show an aggregate
(e.g. a sum indicator from the ETL) that isn't plotted on the chart itself.

## Proposal

Add `map` as a new `DimensionProperty`, following the precedent of `table`
(the explorers' load-but-don't-plot property). A chart config gains at most one

```json
{ "property": "map", "variableId": 123456 }
```

If a `map` dimension exists, it _is_ the map column; `map.columnSlug` keeps its
current meaning ("which of the plotted dimensions to map") only when no `map`
dimension exists. Backward compatible; schema change is additive (no version
bump).

## Why a dimension, not a free-form `map.columnSlug`

Dimensions are the single source of "which variables does this chart need".
A `map` dimension gets for free:

- data fetching (`loadGrapherTableHelpers.ts`, `LegacyToOwidTable.ts` are
  property-agnostic) and the `loadingDimensions` readiness gate
- `chart_dimensions` syncing (`adminSiteServer/apiRoutes/charts.ts`), so
  "charts using variable X" and variable-deletion protection keep working
- entity availability (`baker/updateChartEntities.ts`)
- inheritance safety: `getParentVariableIdFromChartConfig` counts only y
  dimensions; `makeConfigValidForIndicator` preserves non-y dimensions

A bare variable ID in `map.columnSlug` would need bespoke plumbing in each.

## Changes

1. **Types + schema** — add `map` to `DimensionProperty`
   (`types/src/grapherTypes/GrapherTypes.ts`) and to the
   `dimensions[].property` enum in `grapher-schema.011.yaml`; update the
   `map.columnSlug` description.
2. **Resolution** — `mapColumnSlug` (`GrapherState.tsx`) prefers the
   `map`-property dimension's slug when present; otherwise unchanged.
3. **A registered `DimensionSlot`.** `dimensionSlots` appends a Map slot when
   the chart `hasMapTab`. With the slot registered, the editing autorun
   (`validDimensions`) and `setDimensionsForProperty` treat the map dimension
   like any other slot-backed dimension — no special-casing. `DimensionSlot`'s
   `isOptional` becomes `allowMultiple || property === map` (a chart with a
   map tab is valid without a dedicated map dimension; the map falls back to
   the first y dimension).
4. **Admin UI** — the Map slot renders on the data (basic) tab via the
   existing `DimensionSlotView`: add/remove/edit via `VariableSelector` and
   `DimensionCard`, which also makes the map dimension's per-chart `display`
   overrides editable. The map tab's indicator dropdown lists all dimensions
   (the map dimension labeled "(not plotted)"), shows the effective map
   column, and selecting another indicator removes the map dimension — since
   it would otherwise take precedence. Compile-time tripwires:
   `ErrorMessagesForDimensions` (`Record<DimensionProperty, …>`) and
   `DimensionSlot`'s name map.
5. **y-only assumptions to fix alongside:**
    - sources line: the map tab attributes `[y]` dimensions only
      (`sourcesLine.ts`) — show just the map column's source instead; it's
      the only data on screen there
    - CSV download: `inputColumnSlugs` is y/x/size/color, so the map indicator
      would be missing from downloads — always include the map column in
      `prepareTableForDownload` when a `map` dimension exists (the download
      isn't tab-aware, and omitting a shown indicator is worse than one extra
      column)
6. **Tests** — `mapColumnSlug` resolution, `validDimensions` retention,
   `MapChart` with an unplotted indicator; `make svgtest`.

## Works with no changes (verified)

Data fetching, readiness, `chart_dimensions` reference tracking, inheritance,
map tooltip/sparkline (`mapAndYColumnAreTheSame` correctly becomes false; the
sparkline computes its own axis), entity-selector sort-by-indicator, and the
data table tab — the map-only column shows up there automatically, which is
desirable.

## Non-scope / accepted trade-offs

- **mdims** can't express a map indicator (`viewToDimensionsConfig` emits
  y/x/size/color only) — explicit non-scope for now.
- **Explorers** are being discontinued; no explorer work.
- **Search records**: `numDimensions` in Algolia counts all dimensions, so it
  inflates by one — cosmetic. The `property='y'` SQL behind datapages/Algolia
  is unaffected (a map-only indicator doesn't make the chart a datapage chart
  for that indicator — correct).
- **Toggling the map tab off in the editor deletes the map dimension** (the
  Map slot disappears, so the editing autorun drops the dimension). This is
  consistent with how the editor already handles slots — switching chart
  types deletes x/size/color dimensions the new type doesn't support — and
  with the slot visible on the data tab, the removal is legible rather than
  silent. Outside the editor, an orphaned `map` dimension is left untouched.
- **Projections are deferred.** `projectionColumnInfoBySlug` scans only
  `yColumnSlugs`, so a projected map-only indicator won't pair with its
  historical counterpart. Supporting that pairing would require loading _two_
  map variables (projected + historical), breaking the "at most one `map`
  dimension" invariant — a design question of its own. Documented limitation
  for now.

## Decisions

1. **A `map` dimension, when present, wins over `map.columnSlug`.** The
   alternative (keeping `map.columnSlug` as the single pointer that must
   reference the dimension) allows the two to disagree and makes ETL-authored
   configs carry a redundant field.
2. **The map column is always included in CSV downloads** when a `map`
   dimension exists, not only when downloading from the map tab.
3. **The map tab's sources line shows the map column's source**, not the y
   sources (today's `[y]` attribution is only correct because the map column
   is always a y column).
4. **The map dimension is backed by a registered `DimensionSlot` but
   authored from the map tab.** The slot (present when `hasMapTab`) is the
   config-model concept: it keeps `validDimensions`,
   `setDimensionsForProperty` and the editing autorun working without
   special cases. The basic tab does not render it; instead the map tab's
   indicator section hosts the picking flow — a "browse all indicators"
   `VariableSelector` plus an embedded `DimensionCard` for the map
   dimension's `display` overrides and removal. Picking an
   already-plotted indicator normalizes to `map.columnSlug` instead of
   creating a duplicate dimension, so the duplicate case is unreachable via
   the admin; the save-blocking `errorMessagesForDimensions` warning
   remains as a backstop for externally-authored configs.
5. **Projections deferred** (see above).

## Future: retiring `map.columnSlug`?

Considered and parked: express "map shows plotted indicator X" as a `map`
dimension too (duplicating X's variable), and drop `map.columnSlug` entirely.
Findings from scoping this (July 2026, refined August 2026; local DB
snapshot):

- Real usage is far smaller than the raw count. 1,667 configs (of ~31,400
  with a map tab) have `map.columnSlug` in their `full` config, but 1,141
  just repeat the first y variable and 418 are dangling (match no dimension,
  so the first-y fallback kicks in anyway). Only ~108 change what the map
  shows: 58 standalone charts (41 published; mostly UN estimates+projections
  charts mapping the projection variable, e.g. `median-age`), 44 mdim views,
  6 narrative charts, 0 explorer views, 0 indicator configs. Only those 108
  would need a duplicate y+map pair; the other ~1,560 no-op slugs can simply
  be deleted.
- Hard blocker: the 44 mdim views are ETL-authored, and the mdim view format
  cannot express a `map` dimension (`viewToDimensionsConfig` emits
  y/x/size/color only) — mdim map-indicator support has to ship in both
  repos before those usages can migrate at all.
- The 418 dangling slugs are the by-reference footgun in the wild: the field
  rots silently when dimensions change. Counterpoint for keeping it:
  by-reference means the mapped indicator's `display` can never drift from
  its y twin, which a duplicated dimension permits.
- Duplicate-variable dimensions already exist in production (74 charts):
  x+y scatters are disambiguated into two real columns via `targetYear`
  slugs (`getDimensionColumnSlug`); 53 y+color pairs without `targetYear`
  collapse into one column where the _first_ dimension's `display` silently
  wins — 37 of them have differing `display` bags today. A y+map duplicate
  would behave like y+color, and "one shared column, y's display wins" is
  arguably the right semantics — but it should then be a designed pattern
  (normalized dimension order or an explicit merge policy in
  `LegacyToOwidTable`), not the current accident.
- Costs: a breaking schema bump (v012) with a config migration over both
  `patch` and `full`, ETL coordination, a transition read-path for configs
  outside the DB (exports, svg-tester fixtures) that keeps most of the
  ~10-line fallback in `GrapherState.mapColumnSlug` alive indefinitely, and
  — sharpest — an inheritance granularity regression: `mergeGrapherConfigs`
  replaces `dimensions` wholesale, so picking a map indicator would force a
  chart's patch to carry the entire dimensions array instead of the one-leaf
  `map.columnSlug` override, decoupling it from parent dimension updates
  (this bites the 6 narrative charts and indicator-inheriting charts
  directly).

Cheap steps worth taking without the migration: mark `map.columnSlug` as
deprecated in the schema description, and optionally delete the ~1,560 no-op
slugs from patches (zero rendering change), so the eventual migration only
has to audit the ~108 real usages.

Revisit only alongside a schema-breaking window that happens anyway, after
mdims can express a map indicator, and with the duplicate-dimension
`display` semantics defined first.
