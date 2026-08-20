---
title: Research and Writing
---

A mosaic of article tiles linking to related work. Used to showcase
further reading at the bottom of topic and linear topic pages, and on
author pages as the "All work" section.

```archie
{.research-and-writing}
heading: Research & Writing
[.primary]
url: https://docs.google.com/document/d/1qiCu4Yl-YxNgj8cV_0MGB9p6z6WoLF3gFGFspsjK1qU/edit
[]
[.secondary]
url: https://docs.google.com/document/d/1e0HDWjfdRTrbLlAdUMPGtkqmLJJFw9ookSmgBU6JMPI/edit
url: https://docs.google.com/document/d/1-YJoOYf5-_gfSFkJ6sNbMPkAI75VnOOGLSt18_4euL0/edit
[]
[.rows]
heading: More Articles on Medicine and Biotechnology
[.articles]
url: https://docs.google.com/document/d/1-6S3Nsjrb7wFbNizDTvohHGcOzvDvva0UyDoKQUyXnQ/edit
url: https://docs.google.com/document/d/19ytyrpTe5fYQCwAyz25egACwwr9kjyHJkYySzWlYg2Q/edit
url: https://docs.google.com/document/d/1P8pu_FGx6fnJWw-xQBREe49uqN62rZAuARRrR2cdOjc/edit
[]
[]
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

## Properties

- `heading`: The section's heading. Omitted, "Research & Writing" is
  shown.
- `hide-authors`: Written as the word `true` to hide the author line on
  every card — common on author pages where the author is implicit.
  Omitted (or `false`), authors are shown; any other value is reported
  as a parse error.
- `hide-date`: Written as the word `true` to hide the publication date
  on every card. Omitted (or `false`), dates are shown; any other value
  is reported as a parse error.
- `variant`: The only allowed value is `featured`, which applies the
  compact linear-topic-page design; other values are reported as a
  parse error. Omitted, the standard mosaic layout is used.
- `primary`: The large featured card(s), authored as a `[.primary]`
  section of links (see Notes for the link fields). Can be left out on
  author "All work" blocks; without any primary links, the secondary
  links take over as the section's main list.
- `secondary`: The smaller cards next to the featured one, authored as
  a `[.secondary]` section of links.
- `more`: A compact list without thumbnails, authored as a `{.more}`
  block containing a `heading:` and an `[.articles]` list of links —
  the one place links don't need a `filename`. A row without a heading
  or without `[.articles]` is reported as a parse error. Omitted, no
  such list is shown.
- `rows`: Extra titled rows of small cards, authored as a `[.rows]`
  section where each row is a `heading:` followed by an `[.articles]`
  list of links. Omitted, no extra rows are shown.
- `latest`: Authored as a `{.latest}` block with an optional
  `heading:` (omitted, "Latest work" is shown). Its articles are not
  authored — they are filled automatically with the author's latest
  work, excluding anything already listed in `primary` or `secondary`.
  Omit the block entirely to show no latest section.

## Notes

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
