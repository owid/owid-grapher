A chart pull — the chart equivalent of a pull quote. Shows a small chart
thumbnail alongside descriptive text, letting you reference a chart inline
without giving it full width.

```archie
{.pull-chart}
align: left-center
image: hpv-vaccines-thumbnail.png
url: https://ourworldindata.org/grapher/population
[.+content]
Global population has grown rapidly over the past two centuries. Click through to explore the data by country.
[]
{}
```

## When to use

- Referencing a chart to support a point without interrupting the reading
  flow with a full-width interactive chart.
- The chart is ancillary and readers can click through for the full view.

## When NOT to use

- The chart is the main subject of the paragraph — use `{.chart}` or
  `{.narrative-chart}` for a full-width interactive.
- You want a list of several charts — use `{.chart-rows}`.

## Properties

- `align`: Which side the thumbnail floats on, `left-center` (what you get
  when it is omitted) or `right-center`. The text wraps around the other
  side, and the thumbnail pulls slightly into the page margin; on phones
  the two simply stack. An invalid value shows a warning in the admin
  preview and falls back to `left-center`.
- `image`: The chart thumbnail, uploaded via the images admin. It links to
  the interactive chart. Required; without it the block is dropped.
- `url`: The interactive chart the thumbnail links to. Required; without
  it the block is dropped.
- `content`: Text paragraphs next to the thumbnail, authored as a
  `[.+content]` … `[]` section (rich text). They give the chart context
  and double as its screen-reader text; leaving them out triggers a
  warning in the admin preview.
