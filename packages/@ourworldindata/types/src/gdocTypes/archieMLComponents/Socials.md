A list of social / contact links. Used on author pages (as the
`[socials]` section) and inside `{.person}` blocks on about pages.

```archie
[.socials]
url: saloni@ourworldindata.org
text: saloni@ourworldindata.org
type: email

url: https://twitter.com/salonium
text: @salonium
type: x
[]
```

## When to use

- On an author page to link to the author's social profiles and
  email.
- Inside a `{.person}` block on an about page.

## When NOT to use

- Inline in article body — use normal links.

## Properties

- `links`: The links themselves — the block is the list, one entry per
  link with a `url:`, a `text:` display label (both required — an entry
  missing either is dropped with a parse error), and an optional
  `type` that picks the icon: one of `x`, `facebook`, `instagram`,
  `youtube`, `linkedin`, `threads`, `mastodon`, `bluesky`, `email`, or
  `link`; any other value drops the entry, and omitting it shows a
  generic link icon. `type: email` entries get `mailto:` prefixed to
  the url automatically. An empty list drops the whole block.

## Notes

Written as `[socials]` in author-page front matter, but as `[.socials]`
(with the dot) when nested inside a `[+body]` or a `{.person}` block —
without the dot the block is silently dropped.
