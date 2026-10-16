---
title: Deprecating an article
category: Publishing
---

A `[+deprecation-notice]` block above `[+body]` marks an article as
archived.

## The notice

```archie-document
title: Marriage and divorce trends
type: article
authors: Our World in Data

[+deprecation-notice]
This article was originally published in 2016. It is now archived and not being updated. For our current work on this topic, see our topic page on [Marriages and Divorces](https://docs.google.com/document/d/1tqoeu-Qe0qvQi2FwhI5xWhxQbR1hzgxJ-ZjzetJFj_s/edit).
[]

[+body]
Marriage rates have fallen across most regions since the mid-20th century.
[]
```

Only text formatting is allowed inside the block — each paragraph becomes
a plain text block, not a component.

## What changes on the site

- A banner is shown prominently at the top of the article.
- The article gets an archived-look thumbnail wherever it's thumbnailed —
  prominent links, recirc cards, social-media previews.
- The citation and licence sections are altered to discourage citing and
  reusing the article.
- The article is excluded from the site's search index entirely.

## Editorial checklist

- Replace interactive charts in the article with their static versions,
  and set up a redirect from the interactive chart URL to the article URL.
- Link to a related topic page or other up-to-date work in the notice
  itself.

## Notes

Only articles use this field — other document types ignore a
`deprecation-notice` even if one is present in their front matter.
