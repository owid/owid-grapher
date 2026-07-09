---
exemplars:
    - us-crime-rates
    - slavery
skeleton:
    - name: Opening
      description:
          One to three plain paragraphs stating the key message — no heading,
          no chart. The first paragraph doubles as what readers see in
          previews.
      components: [text]
    - name: Sections
      repeats: true
      description:
          Each section opens with a level-1 heading and mixes prose with the
          evidence for it — usually a chart every few paragraphs. Callouts
          flag caveats or data notes; sticky-right pairs a discussion with a
          chart that stays on screen.
      components: [heading, text, chart, callout, sticky-right, image, list]
    - name: Endnotes
      description:
          Optional closing matter — links to related work (prominent-link or
          recirc) and acknowledgements, often set off by a horizontal rule.
      components: [horizontal-rule, prominent-link, recirc]
---

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
