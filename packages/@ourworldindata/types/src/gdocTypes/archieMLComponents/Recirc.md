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

## Notes

Internal links auto-fetch title and thumbnail; override them via `title`
and `subtitle` per link. Don't mix external links with internal ones in
the same block — external sources get no thumbnail, and the mix looks
broken.
