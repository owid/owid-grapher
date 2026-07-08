A vertical list of small chart thumbnails with descriptive text, each row
linking to a chart. Used standalone, or inside a `{.guided-chart}` where
clicking a row updates the guided-chart's main chart rather than
navigating away.

## When to use

- Presenting multiple related chart views compactly.
- Offering alternative cuts of the same data inside a guided chart.

## When NOT to use

- You only have one chart to reference — use `{.pull-chart}`.
- The charts are the main subject — use full-width `{.chart}` blocks.

## Variations

- `kicker`: short label above the rows (defaults to "More views of this
  data" at render time).
- `title` and `source`: only shown in standalone mode; hidden when nested
  inside a `{.guided-chart}`.

### Standalone chart rows

```archie
{.chart-rows}
kicker: More views of this data
title: Daily incomes by decile
source: Global Carbon Budget (2025)

[.rows]
image: chart-1-thumbnail.png
url: https://ourworldindata.org/grapher/daily-income-decile-1
[.+content]
The poorest decile has seen modest gains since 1980.
[]

image: chart-2-thumbnail.png
url: https://ourworldindata.org/grapher/daily-income-decile-10
[.+content]
The richest decile has seen the largest absolute gains.
[]
[]
{}
```
