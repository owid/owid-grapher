---
title: Research and Writing
---

A mosaic of article tiles linking to related work. Used to showcase
further reading at the bottom of topic and linear topic pages, and on
author pages as the "All work" section.

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

## When to use

- At the bottom of a topic page to link to the main articles and
  secondary reads on that topic.
- On linear topic pages (use `variant: featured` for a compact look).
- On author pages to surface the author's work.

## When NOT to use

- Inside regular articles — use `{.recirc}` or `{.prominent-link}`
  for inline recommendations.

## Notes

`hide-date: true` hides article dates across the whole block;
`hide-authors: true` hides authors on all cards (common on author pages
where the author is implicit). `variant: featured` applies the
linear-topic-page design.

Links can be gdoc URLs (metadata auto-resolved) or external links
(supply `title`, `authors`, `filename`). Links in the `more` section
need no thumbnail; all other sections do, unless the gdoc has a
featured-image.

On author pages, two shapes are used. "Featured work" is article-focused:
at least one primary, up to two secondary, plus a `{.latest}` block that
auto-pulls the author's latest articles excluding the featured ones.
"All work" is topic-focused: secondary only, no primary, kept up to date
by hand via /admin/api/all-work?author=…. Never list data insights or
topic pages in it on author pages.
