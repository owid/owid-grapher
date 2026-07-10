---
title: Sticky Left
---

A two-column layout where the left column sticks to the viewport as the
reader scrolls through the (typically longer) right column. Mirror of
`{.sticky-right}`. Collapses to a single column at the tablet breakpoint.

### Chart on the left sticks, text on the right

```archie
{.sticky-left}
[.+left]
{.chart}
url: https://ourworldindata.org/grapher/military-expenditure-share-gdp
{}
Sticky left content.
[]
[.+right]
Right content.
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
