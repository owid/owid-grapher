A sidebar CTA used on linear topic pages that links to a small set of
charts and, if tagged, the data catalog. On desktop it sticks to the
top-right of the intro section; on mobile it appears inline where placed
in the gdoc.

```archie
{.resource-panel}
icon: chart
kicker: Resources
title: Data on corruption
buttonText: See all data on this topic
[.links]
url: https://ourworldindata.org/grapher/bribery-prevalence-un
subtitle: United Nations Office on Drugs and Crime
url: https://ourworldindata.org/grapher/bribery-incidence-for-firms
subtitle: World Bank Enterprise Surveys
url: https://ourworldindata.org/grapher/political-corruption-index
subtitle: Varieties of Democracy Project
[]
{}
```

## When to use

- The intro of a linear topic page, to surface the topic's key charts.

## When NOT to use

- Prefer `{.recirc}` for a simple list of related links outside LTPs.

## Properties

- `icon`: A decorative glyph at the top of the panel. The only allowed
  value is `chart` (a red line-chart icon); other values are reported
  as a parse error. Omitted, no icon is shown.
- `kicker`: A short bold label above the title ("Resources"). Omitted,
  no label is shown.
- `title`: The panel's headline. Required; without it the block is
  dropped and reported as a parse error.
- `links`: The charts to link to, authored as a `[.links]` section with
  a `url:` line per link, each optionally followed by `title:` and
  `subtitle:` lines. Internal links (graphers, explorers, gdocs)
  auto-fetch title, subtitle and thumbnail; external links must have a
  `title` (or the link is skipped) and get no thumbnail.
- `buttonText`: Labels the call-to-action button at the bottom, which
  links to the data catalog filtered to the page's first tag. Omitted
  (or on an untagged page), no button is shown.

## Notes

Place it at least after the first paragraph of the intro section.
