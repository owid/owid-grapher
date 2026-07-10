---
title: Side by Side
---

A two-column layout with left and right columns of roughly equal weight.
Collapses to a single column at the smartphone breakpoint (stays
side-by-side on tablets, unlike `{.sticky-right}` / `{.sticky-left}`).

### Two text blocks side-by-side

```archie
{.side-by-side}
[.+left]
I am content on the left.
[]
[.+right]
I am content on the right.
[]
{}
```

## When to use

- Two visuals or short blocks of text to compare side-by-side.
- Layouts that should remain two-column even on tablets.

## When NOT to use

- When one column is long-form text and the other a visual that should
  stay visible — use `{.sticky-right}` or `{.sticky-left}`.
