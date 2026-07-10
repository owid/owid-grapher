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
