---
title: Headings and structure
category: Structure
---

Headings come from the Google Docs text styles, not from ArchieML: apply
Heading 1, Heading 2 or Heading 3 to a line and it becomes a
`{.heading}` block at that level. The rule of thumb is to open every main
section with Heading 1 and nest with Heading 2, then Heading 3 — three
levels at most.

```archie
{.heading}
text: A main section
level: 1
{}
```

## Heading levels

- **Heading 1** titles a primary section — the largest heading available in
  body text, so it should also title the first section of an article.
- **Heading 2** titles a subsection and belongs only inside a section that
  already has a Heading 1.
- **Heading 3** titles a sub-subsection inside a Heading 2 section.

Deeper Docs styles (Heading 4 and 5) render as small overlines; avoid them
in articles.

## Separating primary sections

A `{.horizontal-rule}` between two Heading 1 sections gives the reader a
visual break. Use it between primary sections only, never between a
heading and its own content.

```archie
{.horizontal-rule}
{}
```

## Notes

Headings generate the sidebar table of contents (`sidebar-toc` on
`{template:article}`) and the anchors that sticky-nav targets point at, so
a heading's wording is also its URL fragment.
