---
exemplars:
    - fertility-rate
skeleton:
    - name: Intro
      description: A topic-page-intro block — a few paragraphs on why the topic
          matters, with related topics and download links alongside. Every
          published topic page opens with one.
      components: [topic-page-intro]
    - name: Key insights
      description:
          A key-insights slider — one slide per takeaway, each pairing a
          heading with a chart and a short discussion.
      components: [key-insights]
    - name: Research & writing
      description: The research-and-writing grid collecting our articles on the
          topic.
      components: [research-and-writing]
    - name: All charts
      description: The all-charts block — the complete gallery of the topic's
          interactive charts, generated from the page's topic tag. Nearly
          every published topic page ends with it.
      components: [all-charts]
---

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
