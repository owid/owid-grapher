---
pinned:
    - slug: the-median-age-in-china-has-rapidly-caught-up-with-the-united-kingdom
---

A static image uploaded to the OWID admin. The `filename` must match an
image registered in the admin (where default alt text is also set).

```archie
{.image}
filename: romania-maternal-mortality-abortions.png
{}
```

## When to use

- Photographs, illustrations, diagrams, and static (non-interactive)
  visuals.
- Static grapher exports where the reader doesn't need to interact with
  the chart — consider `hasOutline: true` for clean white-background
  screenshots so they read as visuals rather than floating artwork.

## When NOT to use

- Interactive charts — use `{.chart}` or `{.narrative-chart}`.
- Flagship data visualizations with metadata — use `{.static-viz}`.
- Videos — use `{.video}`.

## Notes

Prefer setting alt text on the uploaded file in the admin; the `alt`
prop overrides it for context-specific points.

`size: narrow` suits images with especially tall aspect ratios.

Pair two image blocks with opposite `visibility` to serve a different
crop per layout. `smallFilename` is the mobile image — despite the name,
keep it at least 1600px wide for high-density displays.
