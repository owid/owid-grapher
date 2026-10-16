An "enhanced image" block for flagship data visualizations. Registered
in the admin with a description and a source-data link; renders as a
regular image but a "Download" action opens a modal exposing the
additional metadata.

```archie
{.static-viz}
name: world-population-growth
{}
```

## When to use

- Flagship / bespoke data visualizations where readers should be able
  to inspect or download the underlying data.

## When NOT to use

- Regular photos, screenshots, or illustrations — use `{.image}`.
- Interactive charts — use `{.chart}` or `{.narrative-chart}`.

## Properties

- `name`: The static viz's name as registered in the admin — create it at
  /admin/static-viz/ first; the description and source-data link entered
  there are what the download modal surfaces. Required; without it the
  block is dropped.
- `size`: How wide the image sits. `wide` (what you get when it is
  omitted) is a little wider than the body text, `narrow` matches the text
  column, `widest` spans the full page. Any other value drops the block.
- `hasOutline`: Whether the image gets a thin outline box, written as the
  word `true` or `false`. Omitted, the outline is drawn — write `false`
  for artwork that has its own frame or background. Any other value drops
  the block.
- `caption`: A line of rich text under the image. Omitted, no caption is
  shown.
