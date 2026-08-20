A vertical list of small chart thumbnails with descriptive text, each row
linking to a chart. Used standalone, or inside a `{.guided-chart}` where
clicking a row updates the guided-chart's main chart rather than
navigating away.

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

## When to use

- Presenting multiple related chart views compactly.
- Offering alternative cuts of the same data inside a guided chart.

## When NOT to use

- You only have one chart to reference — use `{.pull-chart}`.
- The charts are the main subject — use full-width `{.chart}` blocks.

## Properties

- `kicker`: The short label above the rows. Omitted, "More views of this
  data" is shown.
- `title`: A heading under the kicker. Only displays in standalone mode —
  setting it inside a `{.guided-chart}` triggers a warning in the admin
  preview, where it is hidden. Omitted, no title is shown.
- `source`: A "Data source:" line under the title. Like `title`, it only
  displays in standalone mode and triggers a warning inside a
  `{.guided-chart}`. Omitted, no source line is shown.
- `rows`: The rows themselves, authored as a `[.rows]` … `[]` section, one
  entry per row. Each entry carries an `image:` (a chart thumbnail
  uploaded via the images admin) and a `url:` (the chart the row links
  to), plus a `[.+content]` … `[]` section of text paragraphs describing
  the view (rich text) and optionally a `caption:` line of rich text. At
  least one row is required or the block is dropped; a row missing
  `image:` or `url:` is skipped, and one without content triggers a
  warning in the admin preview.
