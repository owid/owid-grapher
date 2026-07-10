---
title: Linear Topic Page Table of Contents
---

Specialised table of contents for linear topic pages. Primary section
lists page sections; secondary shows cards to all data and writing on
the topic.

### Default title

```archie
{.ltp-toc}
{}

{.heading}
text: How has life expectancy changed?
level: 1
{}

{.heading}
text: Why do people live longer than in the past?
level: 1
{}
```

### Custom title

```archie
{.ltp-toc}
title: On this page
{}

{.heading}
text: How has life expectancy changed?
level: 1
{}

{.heading}
text: Why do people live longer than in the past?
level: 1
{}
```

## When to use

- On linear topic pages, near the top, to let readers jump between
  sections and to related data/writing.

## When NOT to use

- On regular topic pages (use the auto-generated sticky nav).
- On articles (use Google Docs headings; TOC is auto-derived).

## Notes

When `title` is omitted, "Sections" is shown.

The listed sections are derived from the document's level-1 headings —
an `{.ltp-toc}` in a document without headings renders nothing, so the
examples include two.
