---
pinned:
    - slug: us-crime-rates
---

A Grapher chart, explorer, or MDIM embed. The default component for showing
an interactive Our World in Data chart inline.

```archie
{.chart}
url: https://ourworldindata.org/grapher/unemployment-rate
{}
```

```archie
{.chart}
url: https://ourworldindata.org/grapher/military-expenditure-share-gdp
size: narrow
visibility: desktop
peerCountries: parentRegions
{}
```

```archie
{.chart}
url: https://ourworldindata.org/explorers/food-footprints?hideControls=true
{}
```

## When to use

- A standalone chart readers should be able to interact with.
- An explorer (same block, different URL under `/explorers/`).
- An MDIM, with or without controls (set `hideControls=true` in the URL).

## When NOT to use

- Prefer `{.narrative-chart}` when the chart is making a specific argument
  in the article — narrative charts lock selection/title so future data
  updates don't change the point being made.
- Prefer `{.pull-chart}` to reference a chart without giving it full width.

## Properties

- `url`: The chart to show — a Grapher, explorer or MDIM URL. Query params
  in the URL are kept, so they are how you preselect countries or a tab,
  and how you hide an explorer's or MDIM's drop-downs
  (`?hideControls=true`); separate several with `&`. An MDIM with no
  dimension params shows its default view.
- `size`: How wide the chart sits. `wide` (what you get when it is
  omitted) is a little wider than the body text, `narrow` matches the text
  column, `widest` spans the full page. On phones every size fills the
  screen width.
- `height`: Forces the chart frame's height, as a CSS length like `600px`.
  Omitted, the frame keeps Grapher's own aspect ratio — only set it when a
  chart needs unusual vertical room.
- `caption`: A line of text under the chart, in addition to the chart's own
  title and subtitle. Omitted, no caption is shown.
- `visibility`: Shows the block in one layout only — `desktop` hides it on
  phones, `mobile` hides it everywhere else. Omitted, the chart shows in
  both.
- `peerCountries`: Which countries the chart suggests alongside the
  reader's selection: `parentRegions` (containing continent and income
  group), `neighbors`, `gdpPerCapita`, `population`, `dataRange`,
  `defaultSelection`, or `none` to suggest nothing. Omitted, the chart
  keeps its own default (`auto`).

## Notes

Pair two chart blocks with opposite `visibility` to serve a different
aspect ratio per layout.
