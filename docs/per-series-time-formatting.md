# Plan: format each column's times with its own interval

## Problem

A joined table has exactly one time column. After [#6970](https://github.com/owid/owid-grapher/pull/6970) it is tagged with the finest interval that can represent every joined indicator's times, which is right for the axis and the timeline — but it means every series is _labelled_ at that granularity. On a chart mixing daily and monthly indicators, the monthly series' points render as `Jan 1, 2021` instead of `January 2021`.

The information needed is already on the value column: `display.timeInterval` survives the join, so `table.get("990548").timeInterval` is `month` even when the table's time column is `Day`.

Nothing consults it, because formatting goes through another column object:

```
table.get("2")                    // NumericColumn, display.timeInterval = "month"
  .formatTime(-20)
  → this.originalTimeColumn       // no "2-originalTime" column → falls back to table.timeColumn
  → table.get("time")             // DayColumn ← formatter picked by the table, not by this series
  .formatValue(-20)               // → "Jan 1, 2020"
```

`CoreColumn.formatTime` should instead be:

```ts
formatTime(time: number): string {
    return formatTimeForInterval(time, this.timeInterval) // "month" → "Jan 2020"
}
```

That can't be written today: month formatting exists only as `MonthColumn.prototype.formatValue`, reachable only with a `MonthColumn` instance in hand. Synthesizing one inside `originalTimeColumn` was considered and rejected — it hangs "how do I format?" off a member whose job is "which time values does this column show?", a question that legitimately depends on whether tolerance interpolation ran.

## Steps

### 1. Extract interval-keyed time formatters

New functions next to `formatDay` / `formatYear` in `packages/@ourworldindata/utils/src/Util.ts`. The memoized formatters (`memoFormatDay`, `memoFormatWeek`, `memoFormatMonth`, `memoFormatQuarter`, and the CSV variants) move out of `CoreTableColumns.ts` verbatim.

```ts
formatTimeForInterval(time, interval)            // "Jan 21, 2020" | "Jan 2023" | "Week of Jan 20, 2020" | "Q1 2023" | "2020" | "2020s"
formatTimeShortForInterval(time, interval)       // week → "Jan 20, 2020", quarter → "Jan 2026", else same as above
formatTimeRangeForInterval(start, end, interval) // week → ISO Monday…Sunday, quarter → month span, else "X to Y"
formatTimeForCsvForInterval(time, interval)      // "2020-01-21" | "2023-01" | "2023-W03" | "2023-Q1"
timeIntervalName(interval)                       // "Day" | "Week" | "Month" | …
timeIntervalPreposition(interval)                // "on" for day, "in" otherwise
```

Unit-testable with no table fixture.

### 2. Reduce the time column classes to declarations

`DayColumn`, `WeekColumn`, `MonthColumn`, `QuarterColumn`, `YearColumn`, `DecadeColumn` keep `timeInterval`, `parse` and `getUniformlySpacedTimes`, and delegate all formatting:

```ts
class MonthColumn extends DayColumn {
    override get timeInterval() { return TimeInterval.Month }
}
```

`formatValue`, `formatForCsv`, `formatTimeShort` and `formatTimeRange` become identical across the six, so they move up to `TimeColumn` and call the step-1 functions with `this.timeInterval`. `intervalName` and `preposition` come from `timeIntervalName` / `timeIntervalPreposition`.

### 3. Rewrite `AbstractCoreColumn.formatTime*`

```ts
formatTime(time: number): string {
    return formatTimeForInterval(time, this.timeIntervalForFormatting)
}

/** This column's own interval, unless the times it holds use the other encoding */
@imemo private get timeIntervalForFormatting(): TimeInterval {
    const tableInterval = this.table.timeColumn.timeInterval
    return isSubYearly(this.timeInterval) === isSubYearly(tableInterval)
        ? this.timeInterval
        : tableInterval
}
```

Same for `formatTimeShort`, `formatTimeRange`, `formatTimeComparison`.

The guard is the only place that consults the table, and only to ask "days or years?" — never "how do I format?". It exists because a column with no `display.timeInterval` defaults to `year`, and a genuinely yearly column in a day-encoded table holds day-valued original times; formatting those as years yields nonsense (see the entity-selector bug below).

### 4. Drop the formatting consumer of `originalTimeColumn`

After step 3, `CoreTableColumns.ts:147` is gone and the getter has only data-access consumers, which is its actual job: `CoreTable.ts:1044`, `DiscreteBarChartState.ts:307`, `LineChartState.ts:288`, `ScatterPlotChartState.ts:384-397`.

## What this fixes

Every call site whose receiver is a **value column** — roughly 30 of them, no call-site changes needed:

| surface | sites |
| --- | --- |
| Line chart tooltip, incl. "% change since X" | `LineChartTooltip.tsx:121,133` |
| Slope chart labels, tooltip, thumbnail | `SlopeChart.tsx:772,780-781,877-878`; `SlopeChartThumbnail.tsx:65,71` |
| Dumbbell labels, tooltips, tolerance notices | `DumbbellChart.tsx:412,416`; `DumbbellTooltips.tsx:57,73,178,193,304,320` |
| Stacked point labels (`formattedTime`) | `AbstractStackedChartState.ts:290` → `StackedAreaChart.tsx:461,464`, `StackedUtils.ts:104`, `StackedBars.tsx:43` |
| Stacked bar tooltip title | `StackedBarChart.tsx:365` |
| Marimekko bar tooltip y/x times | `MarimekkoChart.tsx:469,482` |
| Scatter tooltip times, ranges, comparisons | `ScatterPlotTooltip.tsx:432,436,437,612` |
| Data table cells, headers, sparklines | `DataTable.tsx:342,373,380,549` |
| Column display names with a target time | `OwidTable.ts:752` |
| `formattedTime` in the values JSON | `GrapherValuesJson.ts:211` → `profiles.ts:541`, `SearchHelpers.ts:44-64` |
| Entity selector sort-column labels | `EntitySelector.tsx:566` |

Plus two extras from `timeIntervalPreposition` / `timeIntervalName`: `DiscreteBarChart.tsx:315` stops saying "on Jan 1, 2021" for a monthly series, and data-table/CSV headers can name the series' own interval instead of the chart-wide one.

## What it deliberately does not fix

- **Call sites whose receiver is the table's time column** (~15) have no series context, so they stay chart-wide: chart title/subtitle range (`GrapherState.tsx:2855-2864`), timeline labels (`TimelineComponent.tsx:433`), discrete bar labels (`DiscreteBarChart.tsx:316`), stacked discrete bar (`:534,591`), Marimekko subtitle (`:486,560`), map tooltips (`MapTooltip.tsx:211,234`), facet-by-time titles (`FacetMap.tsx:227`), scatter time labels (`ScatterPlotChart.tsx:274,280`, `ScatterPlotChartState.ts:350`). For the timeline, the axis and the title that is arguably correct — there is one slider, one axis, one title.
- **CSV downloads.** `OwidTable.toCsv` formats the time cell with the table's time column, and column names come from `col.intervalName` (`OwidTable.ts:773-776`). Re-pointing those at value columns is a separate decision.
- **Axis ticks** build labels from `formatDay` directly (`timeAxisTicks.ts:76`) with the format chosen from `Axis.calendarTickInterval` (`Axis.ts:346-350`) — one interval per axis, by construction.

## Known bug this should clear up

`EntitySelector.getSortColumnLabelTime` (`EntitySelector.tsx:545-559`) is the only existing per-column workaround: when the chart has sub-yearly data and the sort column is yearly, it converts the lookup day back to a year and then formats it — with the table's `Day` column, so the year is read as days-since-epoch:

```
yearly.formatTime(2020) → "Aug 2, 2025"
```

Verified at the table level, and it triggers on today's day + year charts, not just mixed sub-yearly ones. Once formatting follows the column's own interval, the manual conversion can go — but note the encoding guard in step 3 makes a yearly column in a day-encoded table fall back to day formatting, so this needs its own follow-up (either fix the entity selector, or give year columns year-valued original times in mixed tables, which is the day + year half of #5794).

## Tests

- `formatTimeForInterval` and friends: pure unit tests per interval, no fixtures.
- A daily + monthly table: the monthly column formats `Jan 2020` while the daily one formats `Jan 21, 2020`, both before and after tolerance interpolation has run (the case the rejected approach handled inconsistently).
- A yearly column in a day-encoded table: unchanged output, pinning the encoding guard.
- Year + decade: the decadal column formats `2020s` while the annual one formats `2020`.
