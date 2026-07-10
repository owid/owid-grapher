A slide carousel of "key insights" — the core takeaways of a topic
page. Each slide has a title, optional visual (chart, narrative chart,
or image), and a body of rich content.

```archie
{.key-insights}
heading: Key Insights on Poverty
[.insights]

title: The age dependency ratio changes by country
url: https://ourworldindata.org/grapher/age-dependency-breakdown
[.+content]
All sorts of content can go in here.
[]

title: This slide uses an image
filename: default-featured-image.png
[.+content]
Blah blah.
[]

title: This slide uses a narrative chart
narrativeChartName: global-life-expectancy-has-doubled
[.+content]
Blah blah blah.
[]

[]
{}
```

## When to use

- Near the top of a topic page, summarising the most important
  findings on the topic.

## When NOT to use

- On articles or data insights.

## Notes

Each insight's `title` doubles as the slide heading. A slide's visual is
either a `url` (grapher/explorer), a `narrativeChartName`, or a
`filename` (image) — use at most one.

For a `{.callout}` inside an insight, omit its title and make the first
line (e.g. "What you should know about this data") an h5 so the correct
CSS applies.
