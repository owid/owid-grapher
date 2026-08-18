A single data-driven card linking to a Grapher datapage. Shows a custom
title, a short narrative, and an embedded chart pulled from the linked
datapage's indicator. Almost always used as a member of a
`{.key-indicator-collection}` (the homepage accordion of indicators).

```archie
{.key-indicator}
datapageUrl: https://ourworldindata.org/grapher/life-expectancy
title: How has people’s life expectancy changed over time?
source: Long-run estimates collated from multiple sources by Our World in Data
[.+text]
Across the world, people are living longer. In 1900, the global average life expectancy of a newborn was 32 years. By 2021, this had more than doubled to 71 years.
Big improvements were achieved by countries <a href="https://ourworldindata.org/life-expectancy-globally">around the world</a>. The chart shows that life expectancy has more than doubled in every region of the world. This improvement is not only due to declining child mortality; life expectancy increased <a href="https://ourworldindata.org/its-not-just-about-child-mortality-life-expectancy-improved-at-all-ages">at all ages</a>.
This visualization shows long-run estimates of life expectancy brought together by our team from several different data sources. It also shows that the <a href="https://ourworldindata.org/coronavirus">COVID-19 pandemic</a> led to reduced life expectancy worldwide.
[]
{}
```

## When to use

- As one entry inside `{.key-indicator-collection}`.
- Stand-alone in the rare case you want a single highlighted indicator
  with custom narrative text and source attribution.

## When NOT to use

- For a generic chart embed without datapage context — use `{.chart}`.
- For a non-data card with static text — use `{.callout}` or
  `{.data-callout}`.

## Notes

`datapageUrl` must link to a grapher that is a datapage; it can include
query parameters like `?time=earliest..latest` to control the default
view. When `source` is omitted, the indicator's `attributionShort` is
shown instead.
