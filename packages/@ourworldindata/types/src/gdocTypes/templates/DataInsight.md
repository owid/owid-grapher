A short, chart-led observation: a single static image or chart and a few
paragraphs making one point. Published in the data-insights feed under
`/data-insights/{slug}`.

## When to use

- One interesting pattern in the data, explained in a few hundred words.

## When NOT to use

- Prefer `article` when the piece needs sections, multiple charts, or a
  narrative arc.

## Variations

- Set `grapher-url` when the insight is based on a live grapher chart,
  `narrative-chart` when it is based on a narrative chart, and `figma-url`
  to point at the Figma file for the static image.

### Example

```archie
title: Solar power keeps getting cheaper
authors: Jane Doe
type: data-insight
grapher-url: https://ourworldindata.org/grapher/solar-pv-prices
[+body]
The price of solar photovoltaic modules has fallen by more than 99% since 1976.

Every doubling of installed capacity has brought prices down by around 20% — a learning rate that shows no sign of stopping.
[]
```
