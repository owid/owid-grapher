# Improving how Grapher handles entities with missing data

## Current behavior

Our entity selector includes all entities that have data for **any** year. This is intentional:

- We want to signal that we have data for these entities, even if not for the currently selected year.
- We want the set of available entities to be stable — a dynamic list that changes with the time selection isn't necessarily a better experience.

Scatter plots and slope charts have a partial fix: they show a "No data" section when selected entities can't be plotted. But this isn't consistent across chart types.

## Problems

### 1. Selecting an entity does nothing

Selecting an entity that has no data for the current time range is confusing — the user selects it and nothing visibly happens. This is especially confusing in slope charts (and soon dumbbell plots), where an end value might exist and be shown in the entity selector, but no data can be plotted because there's no start value.

### 2. Entities say "No data" when we do have plottable data

The entity selector sometimes shows "No data" for entities that actually have data we could plot — e.g. line chart entities whose time series doesn't include the end time but does cover part of the selected range.

### 3. Entity lists are sometimes simply wrong

In some chart types, entities are offered for selection even when they have no data for **any** year (e.g. [Marimekko: Entities offered for selection that have no data for any year #3492](https://github.com/ourworldindata/owid-grapher/issues/3492)). This is a bug and should be fixed directly.

## Notes

**Availability logic differs by chart type:**

- Single indicator charts that plot a single year: DiscreteBar, Marimekko, ScatterPlot, Map
  -> An entity is available if it has data for the selected year
  -> The entity selector reflects exactly data availabbility for the selected year
- Multi-indicator charts that plot a single year: StackedDiscreteBar
  -> An entity is available if it has data for the selected year for _any_ of the indicators
  -> The entity selector doesn't reflect that exactly but the behaviour is probably fine as-is since the 'No data' message is accurate for the currently selected indicator
- Multi-indicator charts Charts plotting a time range: LineChart, StackedBar, StackedArea
  -> An entity is available if it has any data point between `start` and `end`
  -> The entity selector doesn't reflect, showing "No data" for entities that do have plottable data, but don't include the end time (see problem #2 above)
- Charts plotting a time range with special start/end logic: SlopeChart (DumbbellPlot)
  -> An entity is available only if it has data for **both** `start` and `end`
  -> The entity selector doesn't reflect that, showing "No data" for entities that do have plottable data (e.g. an end value but no start value), and show a data value for entities that aren't actually plottable (e.g. an end value but no start value, which is a common case in our slope charts since many entities only have recent data)

## Solution space

- **Gray out unavailable entities:** Gray out entities that have no data for the current time range, but keep them in the same position in the list. Optionally show a small icon or tooltip explaining why the entity is grayed out. (Discussed with Marwa in a data viz call; felt like the preferred option.)
- **Show matched data in the selector:** The entity selector's data column (which sometimes already says "No data") could reflect exactly what's shown in the chart, giving users immediate feedback. Caveat: this could be problematic for line charts, where mixing values from different years in a single column is misleading — though we could annotate which year each value comes from.
