---
title: Refs and footnotes
category: Writing
---

A ref is a footnote: a superscript number in the text and the source it
points at, collected in the endnotes at the end of the page. Write refs in
two forms — with an ID you define once in the front matter, or inline where
the claim is made.

## ID-based refs

Define the ref in a `[.refs]` block in the front matter (outside `[+body]`),
then cite it anywhere with `{ref}the_id{/ref}`. The same ID can be cited
several times and gets one footnote number.

```archie-document
title: Refs example
type: article
authors: Our World in Data

[.refs]
id: un_wpp_2024
[.+content]
UN, World Population Prospects (2024).
[]
[]

[+body]
Fertility has halved since 1950.{ref}un_wpp_2024{/ref} The decline has
been fastest in Asia.{ref}un_wpp_2024{/ref}
[]
```

If the text between `{ref}` and `{/ref}` contains no whitespace, it is
read as an ID and looked up in the `[.refs]` block. A cited ID with no
definition is a parse error the admin reports on the document.

## Inline refs

Write the source itself between the tags. Handy for a one-off citation you
want to keep next to its claim.

```archie
Life expectancy in Japan reached 84 years.{ref}WHO, Global Health
Observatory (2023).{/ref}
```

Two inline refs with exactly the same text share a footnote number. If you
find yourself repeating one, give it an ID instead.

## Notes

Refs work in any paragraph of prose and inside blocks that hold text, such
as `{.callout}` or `{.expandable-paragraph}`. Details on demand are a
different mechanism — a popup rather than a footnote — see
`{guide:details-on-demand}`.
