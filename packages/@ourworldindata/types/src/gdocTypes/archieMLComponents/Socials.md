A list of social / contact links. Used on author pages (as the
`[socials]` section) and inside `{.person}` blocks on about pages.

## When to use

- On an author page to link to the author's social profiles and
  email.
- Inside a `{.person}` block on an about page.

## When NOT to use

- Inline in article body — use normal links.

## Notes

Each link has a `type` (`link`, `email`, `x`, `facebook`, `instagram`,
`youtube`, `linkedin`, `threads`, `mastodon`, `bluesky`), a `url`, and a
`text` display label.

Written as `[socials]` in author-page front matter, but as `[.socials]`
(with the dot) when nested inside a `[+body]` or a `{.person}` block —
without the dot the block is silently dropped.

### Socials list

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
