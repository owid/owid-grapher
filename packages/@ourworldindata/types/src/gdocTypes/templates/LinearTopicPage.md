A topic entry page that reads as one continuous essay rather than a modular
grid. Gets a sticky navigation generated from its headings (override with
`sticky-nav`). Published under `/{slug}`.

## When to use

- A topic whose content is best presented as a single narrative flow.

## When NOT to use

- Prefer `topic-page` for modular topic pages composed of self-contained
  sections.

### Example

```archie
title: Child Mortality
subtitle: Child deaths are one of the world's largest problems — and one where progress is possible.
authors: Jane Doe
excerpt: Explore data on child mortality around the world.
type: linear-topic-page
[+body]
Child mortality remains one of the world's largest problems.

{.heading}
text: The global picture
level: 1
{}

Around 5 million children under five die every year.
[]
```
