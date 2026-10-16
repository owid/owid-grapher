A chart derivative that can only be viewed inside an article. Narrative
charts are the preferred way of embedding charts in articles — they let
you pin the title, country selection, time range, and chart type so that
future data updates don't change the point being made.

```archie
{.narrative-chart}
name: romania-fertility-rate-abortion
{}
```

## When to use

- The chart is making a specific argument and the selection/title matters.
- You want editorial control independent of the underlying Grapher config.

## When NOT to use

- The reader is meant to freely explore — use `{.chart}` instead.
- For explorers — narrative charts don't wrap those; use `{.chart}`.

## Properties

- `name`: The narrative chart's name, as created in the admin. Required;
  without it the block is dropped. If the name is all you need, the whole
  block can also be written as a single line: `narrative-chart: <name>`.
- `height`: Forces the chart frame's height, as a CSS length like `600px`.
  Omitted, the frame keeps Grapher's own aspect ratio — only set it when a
  chart needs unusual vertical room.
- `size`: How wide the chart sits. `wide` (what you get when it is
  omitted) is a little wider than the body text, `narrow` matches the text
  column, `widest` spans the full page. On phones every size fills the
  screen width. Any other value drops the block.
- `caption`: A line of rich text under the chart, in addition to the
  chart's own title and subtitle. Omitted, no caption is shown.

## Notes

Narrative charts can be based on standalone charts or MDIM views. To
create one from an MDIM, open the share menu on the datapage view and
pick "Create narrative chart".
