A ranked list of one indicator across a country's peer groups: where the
country ranks among, say, its neighbours, Europe and the World, with a
toggle to switch between the groups. Each row shows a country's value as a
dot on a shared axis, with the selected country highlighted and the group
median marked.

```archie
{.peer-ranking}
url: https://ourworldindata.org/grapher/life-expectancy?country=DEU
groups: Neighbours, Europe, High-income countries, World
{}
```

## When to use

- A section of a `{template:profile}` that dives into one key indicator
  and should show how the country compares with similar countries.
- When the reader should see the countries above and below the country,
  not just its rank.

## When NOT to use

- To compare several indicators at once — use `{.peer-comparison}`.
- For a quick overview of ranks among all countries — use
  `{.ranking-cards}`.

## Properties

- `url`: The chart to rank by — a Grapher or explorer URL that selects
  exactly one country via the `country` query parameter, e.g.
  `?country=$entityCode` in a profile. Add `time` to rank at a specific
  year instead of the latest. Required; without it, or with zero or
  several countries, the block is dropped.
- `title`: The heading above the ranking. Omitted, the indicator's name.
- `groups`: The peer groups to toggle between, comma-separated, in
  display order. Each must be `World` (or `All countries`), `Neighbours`,
  or the name of a region with member countries, e.g. `Europe`,
  `High-income countries` or `European Union (27)`; an unknown name
  drops the block. Groups the country isn't part of are skipped.
  Omitted, the country's neighbours (where available), its continent,
  its income group, the EU if it's a member, and the World.
- `sort`: `highest` (the default) ranks the highest value 1st; `lowest`
  ranks the lowest value 1st, for indicators where lower is better.
- `tolerance`: How many years older than the ranking time a country's
  data may be and still be ranked, as a whole number (0 or more).
  Omitted, the indicator's own tolerance.
- `column`: The short name of the y-indicator to rank, for charts with
  several — the same name the `{guide:data-callout-functions}` take.
  Omitted, the first one.

## Notes

`Neighbours` is the country and the countries it shares a land border
with, e.g. Germany and its nine neighbours. Countries without land
neighbours (e.g. Japan or Iceland) silently skip the group, so it is
safe to list in a profile template.

The block is hidden when the chart has no data for the country.
