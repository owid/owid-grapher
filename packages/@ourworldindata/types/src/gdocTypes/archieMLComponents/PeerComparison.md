Compares a country with its peers across several indicators. Each
indicator gets a strip with one dot per country in the selected peer
group, a mark for the group's population-weighted average and the selected country highlighted,
next to the country's value. A toggle switches between the peer groups.

```archie
{.peer-comparison}
title: How Germany compares
groups: Europe, European Union (27), World
[.indicators]
url: https://ourworldindata.org/grapher/life-expectancy?country=DEU
url: https://ourworldindata.org/grapher/gdp-per-capita-worldbank?country=DEU
title: GDP per capita
[]
{}
```

## When to use

- A `{template:profile}` section showing at a glance whether the country
  sits above or below its peers on several related indicators.

## When NOT to use

- For one indicator where the reader should see which countries rank
  above and below — use `{.peer-ranking}`.
- For ranks among all countries — use `{.ranking-cards}`.

## Properties

- `title`: The heading above the strips. Omitted, no heading is shown.
- `groups`: The peer groups to toggle between, comma-separated, in
  display order — `World` (or `All countries`), `Neighbours`, or the name
  of a region with member countries, e.g. `Europe`; an unknown name drops
  the block. Groups the country isn't part of are skipped. Omitted, the
  country's neighbours (where available), its continent, its income
  group, the EU if it's a member, and the World.
- `indicators`: The indicators, authored as an `[.indicators]` … `[]`
  section, each entry starting with `url:` — a Grapher or explorer URL
  that selects exactly one country via the `country` query parameter,
  e.g. `?country=$entityCode` in a profile. Optional per indicator:
  `title` (replaces the indicator's name) and `column` (the short name of
  the y-indicator, for charts with several; omitted, the first one). At
  least one indicator is required; an invalid one drops the block.

## Notes

`Neighbours` is the country and the countries it shares a land border
with; countries without land neighbours (e.g. islands) skip it silently. An indicator without data for the country is hidden,
and the block is hidden when none has data.
