A static image uploaded to the OWID admin. The `filename` must match an
image registered in the admin (where default alt text is also set).

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

## Variations
- `size`: `narrow` | `wide` (default) | `widest`
- `visibility`: `mobile` | `desktop` — pair two image blocks to swap
  aspect ratio between layouts.
- `smallFilename`: dedicated mobile image (should be ≥1600px wide).
- `hasOutline`: `true` | `false` — adds a 1px light-gray outline, useful
  for images with white backgrounds.

### Full featured

```archie
{.image}
filename: default-featured-image.png
smallFilename: default-featured-image.png
alt: my alt text that is optional
size: narrow
caption: I am a caption that would appear below the image
hasOutline: true
visibility: desktop
{}
```

### Minimal

```archie
{.image}
filename: default-featured-image.png
{}
```
