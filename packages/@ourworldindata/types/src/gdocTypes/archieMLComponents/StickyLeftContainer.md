---
title: Sticky Left
---

A two-column layout where the left column sticks to the viewport as the
reader scrolls through the (typically longer) right column. Mirror of
`{.sticky-right}`. Collapses to a single column at the tablet breakpoint.

```archie
{ .sticky-left }
[.+right]
This chart shows the weekly number of new admissions to intensive care units (ICU) due to COVID-19.
Note that this number is different from the total number of patients in ICU due to COVID-19 at any given time. You can find this data in the previous section.
[]
[.+left]
{.chart}
url: https://ourworldindata.org/grapher/weekly-icu-admissions-covid
{}
[]
{}
```

## When to use

- Long-form text on the right discussing a chart or visual on the left —
  so the visual stays visible as the reader scrolls.

## When NOT to use

- When the sticky side should be the right column — use `{.sticky-right}`
  (more common).
- For roughly equal-weight columns — use `{.side-by-side}`.

## Properties

- `left`: The sticky column, authored as a `[.+left]` freeform section —
  usually the chart or visual. It is the wider column (7 of 12) and pins
  near the top of the viewport while the reader scrolls the right column.
  When the layout collapses to one column on tablets and phones it stops
  sticking and comes first. Omitted, the column is left empty.
- `right`: The narrower text column, authored as `[.+right]` — typically
  the longer, scrolling prose. The order of the two sections in the doc
  doesn't matter — the section names decide the columns. Omitted, the
  column is left empty.
