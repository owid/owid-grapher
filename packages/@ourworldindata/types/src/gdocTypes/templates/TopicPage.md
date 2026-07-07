The entry page for a topic: a modular page that opens with a
`{.topic-page-intro}` block and typically composes key insights, featured
metrics and an `{.all-charts}` section. Published under `/{slug}`.

## When to use

- The canonical landing page for a topic in the site navigation.

## When NOT to use

- Prefer `linear-topic-page` when the topic reads as one continuous essay.
- Prefer `article` for standalone pieces within a topic.

### Example

```archie
title: Child Mortality
authors: Jane Doe
excerpt: Explore data on child mortality around the world.
type: topic-page
[+body]
{.topic-page-intro}
[+.content]
A short introduction to the topic and why it matters.
[]
{}

{.all-charts}
heading: Interactive Charts on Child Mortality
{}
[]
```
