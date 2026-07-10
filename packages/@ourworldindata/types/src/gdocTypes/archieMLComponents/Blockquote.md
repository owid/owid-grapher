A way to cite an excerpt from another source. Renders as an indented,
quoted passage with an optional attribution line.

### Plain-text citation

```archie
{.blockquote}
citation: Bastian Herre
[.+text]
Measuring the state of democracy across the world helps us understand the extent to which people have political rights and freedoms.
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
