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

## Notes

A citation starting with `http` becomes the HTML `cite` attribute on the
quote; any other citation (e.g. a person's name) is appended as a visible
attribution footer.
