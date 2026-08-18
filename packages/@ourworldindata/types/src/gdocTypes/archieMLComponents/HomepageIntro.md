---
system: true
---

The large introduction block on the homepage: OWID mission copy
paired with a grid of four featured tiles.

```archie
{.homepage-intro}
[.featured-work]
url: https://docs.google.com/document/d/1xl-Z2-QL9yhfB7lTCkxP7_aF33mUT_mG62LFwEXvsbY/edit?tab=t.kf7sqvb60cvx
kicker: Article · 7 min read
isNew: true

 
url: https://docs.google.com/document/d/1XxqsuE7SyjearmUDaZS_SzGapV_G0DjNyBE9y62cLeQ/edit?tab=t.0
kicker: From our classics

 
url: https://docs.google.com/document/d/17-w7FZpkfqbfGlEE0d4VkkfpfKVQoYqAp7Y66RIt6o8/edit
kicker: Article · 5 min read

 
url: https://docs.google.com/document/d/10M5sJhpAaXXC7O9flEywoaeT3m10pDe1_sErOOe-PeI/edit?tab=t.0
title: We published a new topic page on work and employment
description: Explore key concepts and data on labor market participation, unemployment, and employment, and how the trends differ across countries and over time.
kicker: Topic page

 
[]
{}
```

## When to use

- Only on the homepage (`type: homepage`).

## When NOT to use

- Anywhere else. The mission text is hard-coded for the homepage
  layout.

## Notes

Supply exactly four entries under `[.featured-work]`. `kicker` is free
text (e.g. "Article - 10 Min Read", "Announcement") — no strong
conventions yet. `isNew: true` shows a red "NEW" pill before that tile's
kicker. gdoc URLs auto-resolve title/description; external URLs require
those fields explicitly.
