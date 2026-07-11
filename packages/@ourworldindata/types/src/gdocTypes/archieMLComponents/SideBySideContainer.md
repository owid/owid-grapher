---
title: Side by Side
---

A two-column layout with left and right columns of roughly equal weight.
Collapses to a single column at the smartphone breakpoint (stays
side-by-side on tablets, unlike `{.sticky-right}` / `{.sticky-left}`).

```archie
{ .side-by-side }
[.+right]
{.chart}
url: https://ourworldindata.org/grapher/share-of-deaths-cause-is-registered
{}
[]
[.+left]
{.chart}
url: https://ourworldindata.org/grapher/share-of-deaths-registered
{}
[]
{}
```

## When to use

- Two visuals or short blocks of text to compare side-by-side.
- Layouts that should remain two-column even on tablets.

## When NOT to use

- When one column is long-form text and the other a visual that should
  stay visible — use `{.sticky-right}` or `{.sticky-left}`.
