---
title: Linear Topic Page Table of Contents
---

Specialised table of contents for linear topic pages. Primary section
lists page sections; secondary shows cards to all data and writing on
the topic. The document must have a topic tag so the cards know what
to link to.

```archie
{.ltp-toc}
{}

{.heading}
text: How long do people live?
level: 1
{}

{.heading}
text: Why has life expectancy increased?
level: 1
{}
```

## When to use

- On linear topic pages, near the top, to let readers jump between
  sections and to related data/writing.

## When NOT to use

- On regular topic pages (use the auto-generated sticky nav).
- On articles (use Google Docs headings; TOC is auto-derived).
- On documents without a topic tag — the block shows an error instead.

## Properties

- `title`: The label shown above the list of sections. Omitted,
  "Sections" is shown.

## Notes

The listed sections are derived from the document's level-1 headings —
an `{.ltp-toc}` in a document without headings renders nothing. The
`{.heading}` blocks in the examples are only there to give the preview
sections to list; in a Google Doc, write the sections as Heading 1
paragraphs and leave them out of the snippet.
