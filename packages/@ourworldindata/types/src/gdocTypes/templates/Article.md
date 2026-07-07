A standalone piece of writing: our default document type for essays, data
explainers and topic deep-dives. Published under `/{slug}`.

## When to use

- Any self-contained narrative piece that is not the entry page of a topic.

## When NOT to use

- Prefer `data-insight` for a short, chart-led observation.
- Prefer `topic-page` / `linear-topic-page` for the entry page of a topic.

### Example

```archie
title: The decline of global child mortality
subtitle: Child deaths have fallen from over 20 million per year in 1950 to under 5 million today.
authors: Jane Doe
dateline: June 30, 2026
excerpt: Child mortality has fallen dramatically over the last two centuries.
type: article
featured-image: child-mortality-featured.png
[+body]
Over the last two centuries, child mortality has declined in every world region.

{.chart}
url: https://ourworldindata.org/grapher/child-mortality
{}

{.heading}
text: Why did child mortality decline?
level: 1
{}

Improvements in nutrition, sanitation, vaccination and access to healthcare all played a role.
[]
```
