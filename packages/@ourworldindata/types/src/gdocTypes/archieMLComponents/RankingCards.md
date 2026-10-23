A grid of cards that shows where a country ranks among all countries on
several indicators. Each card shows the indicator, the country's latest
value, its rank (e.g. "30th of 229"), a bar placing the value between the
lowest and highest country, and how many places it moved since an earlier
year. Each card links to its chart.

```archie
{.ranking-cards}
title: Germany at a glance
change-since: 10
[.cards]
url: https://ourworldindata.org/grapher/life-expectancy?country=DEU
topic: Health
url: https://ourworldindata.org/grapher/child-mortality?country=DEU
topic: Health
sort: lowest
url: https://ourworldindata.org/grapher/gdp-per-capita-worldbank?country=DEU
title: GDP per capita
topic: Economy
[]
{}
```

## When to use

- An "at a glance" overview near the top of a `{template:profile}`,
  summarising where the country stands on a handful of key indicators.
- When the rank among all countries matters more than the exact value.

## When NOT to use

- To rank a country within a region or income group — use
  `{.peer-ranking}` (one indicator, full ranked list) or
  `{.peer-comparison}` (several indicators side by side).
- To weave a single value into prose — use `{.data-callout}`.
- For indicators where a rank isn't meaningful, e.g. totals that mostly
  reflect population size.

## Properties

- `title`: A heading above the grid. Omitted, no heading is shown.
- `subtitle`: A short line under the title. Omitted, none is shown.
- `sparklines`: `true` adds a small line chart to each card comparing the
  country with the World over time. Omitted or `false`, no sparklines.
- `changeSinceYears`: How many years back the "Up/Down N places since
  YEAR" line compares the rank with, authored as `change-since:` and a
  whole number of years (1 or more). Omitted, 10 years. Cards hide the line when there's no data that far
  back.
- `cards`: The cards, authored as a `[.cards]` … `[]` section, each entry
  starting with `url:`. `url` is required: a Grapher or explorer URL that
  selects exactly one country via the `country` query parameter, e.g.
  `?country=$entityCode` in a profile. Optional per card: `title`
  (replaces the indicator's name), `topic` (a short label above the
  title, e.g. "Health", coloured by topic), `sort` (`highest`, the
  default, ranks the highest value 1st; `lowest` ranks the lowest value
  1st, for indicators where lower is better) and `column` (the short
  name of the y-indicator to rank, for charts with several — the same
  name the `{guide:data-callout-functions}` take; omitted, the first
  one). At least one card is required; an invalid card drops the block.

## Notes

Ranks are among all countries (up to 229) that have data at the ranking
time — the latest year any country has data for, or the end of the `time`
range in the `url` if it sets one. A country whose data is a year or two older
can still be ranked if the indicator allows for that (its tolerance).

A card without data for the country is hidden; if no card has data, the
whole block is hidden. In a profile, a block that renders counts like a
rendering `{.data-callout}` for whether the page is baked — see
`{guide:profile-placeholders}`.
