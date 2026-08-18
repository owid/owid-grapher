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

## Notes

Place it at least after the first paragraph of the intro section.
`kicker` renders as a short label above the title; `buttonText` labels
the bottom call-to-action button.
