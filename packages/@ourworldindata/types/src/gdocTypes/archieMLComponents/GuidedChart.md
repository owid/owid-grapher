A scroll-driven chart where links in the body text drive updates to a
single chart (Grapher or MDIM; explorers are not supported). Link syntax
is a grapher URL prefixed with `#guide:` — e.g.
`#guide:https://ourworldindata.org/grapher/life-expectancy?country=~NZL`.
All `#guide:` links in the section must share the same slug; only query
params (selection, time, tab, etc.) can change.

### Sticky-left layout with a chart and guided links

```archie
[.+guided-chart]
{.sticky-left}
[.+left]
{.chart}
url: https://ourworldindata.org/grapher/life-expectancy
{}
[]
[.+right]
I am a link that will update the chart to show New Zealand when clicked
[]
{}
[]
```

## When to use

- Walking readers through different views of the same chart inline.
- Pairing a chart with prose where clicking phrases updates the chart.

## When NOT to use

- The chart and text are independent — use `{.chart}` in a `{.sticky-left}`
  / `{.sticky-right}` layout.
- You need more than one chart slug — guided-chart sections must have
  exactly one chart.

## Notes

Designed for `{.sticky-left}` / `{.sticky-right}` two-column layouts but
works in a single column too. Multiple guided-chart sections per page are
fine.

Can contain a `{.chart-rows}` block — clicking a row updates the main
chart rather than navigating away. In guided-chart mode, `title` and
`source` on the chart-rows are hidden.
