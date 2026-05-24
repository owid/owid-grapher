A sidebar CTA used on linear topic pages that links to a small set of
charts and, if tagged, the data catalog. On desktop it sticks to the
top-right of the intro section; on mobile it appears inline where placed
in the gdoc.

## When to use
- The intro of a linear topic page, to surface the topic's key charts.

## When NOT to use
- Prefer `{.recirc}` for a simple list of related links outside LTPs.

## Variations
- `icon`: currently only `chart` is supported.
- `kicker` is a short label rendered above the title.
- `buttonText` is the label of the bottom call-to-action button.

### LTP intro resource panel

```archie
{.resource-panel}
kicker: Resources
icon: chart
title: Data on this topic
buttonText: See all data on this topic
[.links]
url: https://ourworldindata.org/grapher/access-to-clean-fuels-and-technologies-for-cooking
subtitle: World Health Organization - Global Health Observatory (2025)

url: https://ourworldindata.org/grapher/annual-co2-emissions-per-country
subtitle: Global Carbon Budget (2024)
[]

{}
```
