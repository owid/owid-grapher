A single data-driven card linking to a Grapher datapage. Shows a custom
title, a short narrative, and an embedded chart pulled from the linked
datapage's indicator. Almost always used as a member of a
`{.key-indicator-collection}` (the homepage accordion of indicators).

## When to use
- As one entry inside `{.key-indicator-collection}`.
- Stand-alone in the rare case you want a single highlighted indicator
  with custom narrative text and source attribution.

## When NOT to use
- For a generic chart embed without datapage context — use `{.chart}`.
- For a non-data card with static text — use `{.callout}` or
  `{.data-callout}`.

## Variations
- `datapageUrl` (required): URL of the Grapher datapage; can include
  query parameters like `?time=earliest..latest` to control the default
  view.
- `title` (required): the headline shown above the narrative.
- `text` (required): the narrative paragraph(s).
- `source` (optional): attribution string; defaults to the indicator's
  `attributionShort` if omitted.

### Standalone key indicator

```archie
{.key-indicator}
datapageUrl: https://ourworldindata.org/grapher/life-expectancy
title: How did people's life expectancy change over time?
[.+text]
Life expectancy has more than doubled in the last two centuries.
[]
source: Long-run data from UN World Population Prospects
{}
```
