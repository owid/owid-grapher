A slide carousel of "key insights" — the core takeaways of a topic
page. Each slide has a title, optional visual (chart, narrative chart,
or image), and a body of rich content.

## When to use
- Near the top of a topic page, summarising the most important
  findings on the topic.

## When NOT to use
- On articles or data insights.

## Variations
- Each slide's visual is either a `url` (grapher/explorer), a
  `narrativeChartName`, or a `filename` (image). Use at most one.

### With mixed visuals

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
