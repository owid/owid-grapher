---
title: Sticky nav on topic pages
category: Structure
---

Topic pages get a pinned navigation bar generated from their headings.

## Automatic buttons

The site always adds an "Introduction" button pointing at `#introduction`,
then scans the body's headings for slugs matching one of these patterns:

- a heading starting with "Acknowledgements" → **Acknowledgements**
- a heading starting with "Country Profiles" → **Country Profiles**
- a heading starting with "Explore data on …" or "Explore our data on …"
  → **Data Explorer**
- a heading matching "Key Insights" anywhere in its slug → **Key
  Insights**
- a heading matching "All Charts" anywhere in its slug → **Charts**
- a heading matching "Research & Writing" anywhere in its slug →
  **Research & Writing**

The first three patterns only match at the start of the heading's slug;
the last three match anywhere in it, so "Key Insights on Poverty" still
yields a button — the button itself always reads "Key Insights".

A `{.key-insights}`, `{.all-charts}`, or `{.research-and-writing}` block
adds its matching button too, whenever the block is present in the body —
no heading match is needed for these.

## Manual override

If your headings aren't matched by the patterns above, specify the sticky
nav yourself: a `[.sticky-nav]` array of `target:` (an anchor starting with
`#`) and `text:` pairs in the front matter, outside `[+body]`. An explicit
`[.sticky-nav]` is used as-is instead of the automatic buttons.

```archie-document
title: Fertility topic page
type: topic-page
authors: Our World in Data

[.sticky-nav]
target: #introduction
text: Introduction

target: #children-per-woman
text: Children per woman
[]

[+body]
{.heading}
text: Children per woman
level: 1
{}

The fertility rate is the average number of children born per woman.
[]
```

## Linear topic pages

The automatic buttons, and the sticky nav itself, only apply to
`type: topic-page` documents. A `[.sticky-nav]` block written on a
`type: linear-topic-page` document is discarded and has no effect. See
`{template:linear-topic-page}`.

## Notes

Sticky nav targets are heading anchors, so renaming a heading changes its
target — see `{guide:headings-and-structure}`.
