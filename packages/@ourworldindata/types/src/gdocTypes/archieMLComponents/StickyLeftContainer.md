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
