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

## Properties

- `left`: The left column, authored as a `[.+left]` freeform section
  inside the block — any content works, most often a chart or image.
  Omitted, the column is simply left empty. When the layout collapses on
  smartphones, this column comes first.
- `right`: The right column, authored as `[.+right]`. The order of the
  two sections in the doc doesn't matter — the section names decide the
  columns. Omitted, the column is left empty.
