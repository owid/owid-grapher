---
decision: none
auto-generated: a plain paragraph
---

A paragraph of prose. Text spans support Google Docs formatting (bold,
italic, links, superscript, subscript), refs, and details-on-demand
links.

## Properties

- `value`: The paragraph's rich text; Docs formatting (bold, italic,
  links, superscript, subscript), refs and details-on-demand links
  carry through to the page.

## Notes

Footnotes: `{ref}example_id{/ref}` resolves against the front-matter
`[.refs]` block, so a ref can be reused across the document —
whitespace-free content is treated as an ID. Inline refs
(`{ref}free text{/ref}`) also work; identical inline refs share a
footnote number.

Details on demand: link a phrase to `#dod:your_dod_id`. In grapher
subtitles and footers use markdown instead:
`[Primary energy](#dod:primaryenergy)`.

Starting a paragraph with a word followed by a colon would be parsed as
an archie key — escape it: `Blah\: explanation`.

Lines between `:skip` and `:endskip` are archie comments, though Google
Docs comments are usually the better tool.
