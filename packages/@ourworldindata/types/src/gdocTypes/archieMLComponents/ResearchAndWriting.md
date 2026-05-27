---
title: Research and Writing
---

A mosaic of article tiles linking to related work. Used to showcase
further reading at the bottom of topic and linear topic pages, and on
author pages as the "All work" section.

## When to use

- At the bottom of a topic page to link to the main articles and
  secondary reads on that topic.
- On linear topic pages (use `variant: featured` for a compact look).
- On author pages to surface the author's work.

## When NOT to use

- Inside regular articles — use `{.recirc}` or `{.prominent-link}`
  for inline recommendations.

## Variations

- `primary` is required (one or more tiles); `secondary`, `more`, and
  `rows` sections are optional.
- `hide-date: true` hides article dates across the block.
- `hide-authors: true` hides authors (common on author pages where
  the author is already implicit).
- `variant: featured` — compact rendering used on linear topic pages.
- Links can be gdoc URLs (metadata auto-resolved) or external links
  (supply `title`, `authors`, `filename`).
- A `{.latest}` block inside auto-pulls latest articles not already
  featured (used on author pages).

### Full mosaic

```archie
{.research-and-writing}

[.primary]
url: https://wikipedia.org
authors: Author 1, Author 2
title: What are Bananas?
subtitle: There is no single definition of bananas.
filename: bananas.jpg
[]

[.secondary]
url: https://ourworldindata.org/optimism-and-pessimism
title: Optimism and Pessimism
authors: Max Roser
filename: default-featured-image.png
[]

{.more}
heading: More Key Articles on Poverty
[.articles]
url: https://ourworldindata.org/poverty
title: The history of the end of poverty has just begun
authors: Max Roser

url: https://ourworldindata.org/poverty-growth-needed
title: The economies that are home to the poorest billions of people need to grow
authors: Max Roser
[]
{}

[.rows]
heading: A row of articles
[.articles]
url: https://ourworldindata.org/optimism-and-pessimism
title: Optimism and Pessimism
authors: Max Roser
filename: default-featured-image.png

url: https://ourworldindata.org/wrong-about-the-world
title: Most of us are wrong about how the world has changed
authors: Max Roser
filename: default-featured-image.png
[]
[]
{}
```

### Featured variant (linear topic pages)

```archie
{.research-and-writing}
variant: featured
{}
```
