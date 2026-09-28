---
title: Writing basics
category: Writing
---

A document is front matter followed by a `[+body]` … `[]` block. Everything
you write inside `[+body]` becomes the article's content; a plain paragraph
of text becomes a `{.text}` block with no key of its own.

## Front matter and body

```archie-document
title: Population growth
type: article
authors: Our World in Data

[+body]
Global population has grown rapidly since 1950.

It is expected to peak later this century.
[]
```

## Formatting

Bold, italic, links, superscript and subscript all carry through from
Google Docs formatting — apply them in the Doc, not in ArchieML. Inline
HTML is not allowed except for rare cases that Docs formatting can't
cover; for those, use an `{.html}` block instead.

## Comments and skipped lines

Lines between `:skip` and `:endskip` are ignored by the parser. Google
Docs' own commenting feature is usually the better tool for a note to a
collaborator; reach for `:skip` only when you're writing directly in the
`[+body]` block.

```archie
This paragraph is published as usual.

:skip
This line is a comment and is ignored.
:endskip
```

## Escaping a leading colon

A paragraph starting with a word followed by a colon is parsed as an
ArchieML key. Escape the colon to write it as prose:

```archie
Blah\: an explanation of blah
```

## Lists

Google Docs bullet formatting becomes a `{.list}` block automatically —
you don't write it explicitly. Numbered lists must be written out as a
`{.numbered-list}` block, one `*` per item:

```archie
[.numbered-list]
* Numbered
* List
[]
```

Nested lists are not supported
([issue #2468](https://github.com/owid/owid-grapher/issues/2468)).

## Notes

For footnotes, see `{guide:refs}`; for definition popups, see
`{guide:details-on-demand}`; for section headings, see
`{guide:headings-and-structure}`.
