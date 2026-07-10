---
title: Sticky Right
---

A two-column layout where the right column sticks to the viewport as the
reader scrolls through the (typically longer) left column. Collapses to a
single column at the tablet breakpoint.

### Text on the left, chart sticks on the right

```archie
{.sticky-right}
[.+left]
Content on the left. Lorem ipsum dolor sit amet.
[]
[.+right]
{.chart}
url: https://ourworldindata.org/grapher/military-expenditure-share-gdp
{}
Content on the right that sticks as the user scrolls.
[]
{}
```

## When to use

- Long-form text on the left that discusses a chart, image, or visual on
  the right — so the visual stays visible as the reader scrolls.
- Guided-chart sections where the chart is in the right column.

## When NOT to use

- Two roughly equal-weight blocks that should collapse at a narrower
  breakpoint — use `{.side-by-side}` instead.
- When the sticky side should be the left column — use `{.sticky-left}`.
