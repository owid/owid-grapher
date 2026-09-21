---
title: Data callout functions
category: Charts & data
---

`$latestTime()` and `$latestValue()` interpolate live chart values into text
inside `{.data-callout}` and `{.data-callout-group}` blocks. Both
read from the chart at the callout's `url`, so the wording stays correct as
the chart's underlying data changes.

```archie
{.data-callout}
url: https://ourworldindata.org/grapher/life-expectancy?country=CAN
[.+content]
In $latestTime(), Canada's life expectancy was $latestValue()
[]
{}
```

## Functions

- `$latestTime()`: the time of the chart's most recent data point, written
  the way the chart itself formats a single point in time — a year, e.g.
  "2023", or a day-level date, e.g. "Jan 15, 2024".
- `$latestValue()`: that data point's value, formatted the way the chart
  formats it.
- `$latestValueWithUnit()`: the same value with an abbreviated unit.

For a chart with more than one y-indicator, pass the column's short name as
an argument to say which one you mean, e.g. `$latestTime(emissions_total)`
and `$latestValue(emissions_total)` to pick out
[trade-adjusted emissions](https://ourworldindata.org/grapher/production-vs-consumption-co2-emissions?country=~USA)
on a chart that plots several. A chart with a single y-indicator doesn't
need the argument.

To pin the callout to a specific period instead of the chart's latest, add
`time` to the `url`, e.g. `?country=CAN&time=earliest..1861`. `$latestTime()`
then means "the latest time for this particular view" — which may not be
the chart's true latest.

## Finding column names

Visit `/admin/callout-functions` and paste in the chart's URL: it lists
every function string available for that chart, including the exact
argument to pass for each indicator the chart exposes, ready to copy into a
callout.

## When there is no data

If the chart at `url` has no data for the country the callout resolves to,
the whole `{.data-callout}` — or the whole `{.data-callout-group}`
if none of its callouts have data — is dropped rather than rendering blank.
In `{template:profile}`, a profile where every callout in the body
ends up with no data for a given entity is not baked for that entity at
all.
