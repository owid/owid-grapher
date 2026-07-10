---
pinned:
    - slug: us-crime-rates
---

A Grapher chart, explorer, or MDIM embed. The default component for showing
an interactive Our World in Data chart inline.

### Basic

```archie
{.chart}
url: https://ourworldindata.org/grapher/military-expenditure-share-gdp
{}
```

### Narrow, desktop only

```archie
{.chart}
url: https://ourworldindata.org/grapher/military-expenditure-share-gdp
size: narrow
visibility: desktop
peerCountries: parentRegions
{}
```

### Explorer with controls hidden

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

## Notes

Pair two chart blocks with opposite `visibility` to serve a different
aspect ratio per layout; omit it to show the chart in both.

For explorers and MDIMs, append `?hideControls=true` to the URL to hide
the control drop-downs; separate multiple query params with `&`. Without
query params an MDIM renders its default view; dimension query params
select a specific view.

`peerCountries` controls which peer countries the country selector
offers.
