The large introduction block on the homepage: OWID mission copy
paired with a grid of four featured tiles.

## When to use
- Only on the homepage (`type: homepage`).

## When NOT to use
- Anywhere else. The mission text is hard-coded for the homepage
  layout.

## Variations
- Exactly four entries must be supplied under `[.featured-work]`.
- `kicker` is free text (e.g. "Article - 10 Min Read",
  "Announcement").
- `isNew: true` shows a red "NEW" pill on that tile.
- gdoc URLs auto-resolve title/description; external URLs require
  those fields explicitly.

### Four featured tiles

```archie
{.homepage-intro}

[.featured-work]
url: https://docs.google.com/document/d/1iH_m2GlsBuif80sDwfg0fNGZmpf9X0-TFM5oHQr9fPA/edit
kicker: Article - 10 Min Read
isNew: true

url: https://docs.google.com/document/d/1KCSkpWvSml9KZaqTO7TGWsUDpACZIxBoqs9Yw62Klx8/edit
kicker: Article - 10 Min Read

url: https://docs.google.com/document/d/1PvKMIDp0Npp-t_5F-tNp-w9Y2Lq4ifjWDJHEVQQ6bNw/edit
kicker: Article - 10 Min Read

url: https://docs.google.com/document/d/11t6XP9vKLDHeiDOcfaPOoc4TeQxHRixSjEikAlbGe0A/edit
title: We updated our topic page on Artificial Intelligence
kicker: Announcement
[]

{}
```
