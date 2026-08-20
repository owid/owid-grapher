A way to cite an excerpt from another source. Renders as an indented,
quoted passage with an optional attribution line.

```archie
{.blockquote}
citation: Chris Whitty, Chief Medical Officer for England
[.+text]
“The key points about vaping (e-cigarettes) can be easily summarised. If you smoke, vaping is much safer; if you don’t smoke, don’t vape.”
[]
{}
```

## When to use

- Quoting a longer passage from a person, paper, or publication.

## When NOT to use

- Prefer `{.pull-quote}` when you want to re-emphasize a phrase from the
  article itself (styled as a centered, italicized h1).

## Properties

- `text`: The quoted passage — one or more paragraphs of rich text,
  authored as a `[.+text]` freeform section. Required; without it the
  block is dropped and reported as a parse error.
- `citation`: Optional attribution. A citation starting with `http`
  becomes the (invisible) HTML `cite` attribute on the quote; any other
  citation (e.g. a person's name) is appended as a visible attribution
  footer. A web address missing its `http://` or `https://` prefix is a
  parse error and drops the block. Omitted, no attribution is shown.
