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

## Properties

- `heading`: The heading above the carousel ("Key Insights on
  Poverty"). Required; without it the block is dropped and reported as
  a parse error.
- `insights`: The slides, authored as an `[.insights]` section where
  each slide starts with a `title:` line — the slide's heading, which
  also labels its button in the slide navigation (a slide without a
  title is dropped). Each slide's visual is exactly one of `url:` (a
  grapher or explorer URL), `filename:` (an image), a
  `narrativeChartName:`, or an `[.+asset]` section holding a single
  chart, narrative chart, image, static viz, video, html or bespoke
  component block — none or more than one is reported as a parse
  error. The slide's body is authored as an `[.+content]` freeform
  section of ordinary blocks; a slide without content is reported as a
  parse error.

## Notes

For a `{.callout}` inside an insight, omit its title and make the first
line (e.g. "What you should know about this data") an h5 so the correct
CSS applies.
