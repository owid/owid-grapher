A Grapher chart, explorer, or MDIM embed. The default component for showing
an interactive Our World in Data chart inline.

## When to use
- A standalone chart readers should be able to interact with.
- An explorer (same block, different URL under `/explorers/`).
- An MDIM, with or without controls (set `hideControls=true` in the URL).

## When NOT to use
- Prefer `{.narrative-chart}` when the chart is making a specific argument
  in the article — narrative charts lock selection/title so future data
  updates don't change the point being made.
- Prefer `{.pull-chart}` to reference a chart without giving it full width.

## Variations
- `size`: `narrow` | `wide` (default) | `widest`
- `visibility`: `mobile` | `desktop` — pair two chart blocks to swap
  aspect ratio between layouts. Omit to show in both.
- `peerCountries`: `parentRegions` | `gdpPerCapita` | `population` |
  `dataRange` | `defaultSelection` | `neighbors` — controls which peer
  countries are offered in the country selector.

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
