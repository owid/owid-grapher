A small gray block, usually placed to the side of body text, that links
readers to related content (articles, graphers, explorers, MDIMs, or
external URLs).

```archie
{.recirc}
title: Related charts
[.links]
url: https://ourworldindata.org/grapher/labor-force-participation-rate?age_group=_15_plus&sex=female
title: Explore labor force participation data
subtitle: Participation rates by age groups and sex
url: https://ourworldindata.org/grapher/labor-force-participation-rate-by-age?tab=discrete-bar&time=latest
[]
{}
```

## When to use

- Surfacing related reading alongside an article.
- Linking to charts, explorers, MDIMs, or external sources without
  interrupting the main flow.

## When NOT to use

- Prefer `{.prominent-link}` for a single, more visually prominent link
  tile.
- Prefer `{.resource-panel}` on linear topic pages when you want a sticky
  sidebar CTA.

## Properties

- `title`: The blue heading above the list of links. Required; without
  it the block is dropped and reported as a parse error.
- `align`: Where the block sits on desktop: `left` or `right` place it
  in a narrow side column next to the body text (link thumbnails are
  hidden there), `center` (what you get when it is omitted) puts it in
  the main text column. Other values are reported as a parse error.
- `links`: The links themselves, authored as a `[.links]` section with
  a `url:` line per link, each optionally followed by `title:` and
  `subtitle:` lines. Internal links (gdocs, graphers, explorers)
  auto-fetch title, subtitle and thumbnail, so `url` alone is enough;
  external links must have a `title` (or the link is skipped) and get
  no thumbnail. Don't mix internal and external links in one block —
  the parser reports it as an error; use a separate recirc for each.
