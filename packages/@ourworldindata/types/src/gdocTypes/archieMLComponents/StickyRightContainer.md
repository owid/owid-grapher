---
title: Sticky Right
---

A two-column layout where the right column sticks to the viewport as the
reader scrolls through the (typically longer) left column. Collapses to a
single column at the tablet breakpoint.

```archie
{ .sticky-right }
[.+right]
{.chart}
url: https://ourworldindata.org/grapher/cumulative-deaths-in-armed-conflicts-by-region-and-type?country=Americas~OWID_EUR~Asia+and+Oceania~Middle+East~OWID_AFR
{}
[]
[.+left]
Breaking down conflict deaths by region and type at the same time reveals that the dominant forms of conflict differ across regions.
The chart shows, by region, the share of deaths each conflict type is responsible for.
{.heading}
text: Africa
level: 2
{}
One-sided violence was the deadliest form of conflict in Africa, accounting for half of its deaths between 1989 and 2024. A significant portion of these deaths resulted from a single act of violence: the 1994 genocide in <a href="https://ourworldindata.org/explorers/countries-in-conflict-data?region=Africa&country=~RWA&Measure=Conflict+deaths&Conflict+type=All+armed+conflicts&Conflict+sub-type=By+sub-type">Rwanda</a>.
Intrastate conflicts caused more than a third of all deaths, particularly in <a href="https://ourworldindata.org/explorers/countries-in-conflict-data?region=Africa&country=~ETH&Measure=Conflict+deaths&Conflict+type=All+armed+conflicts&Conflict+sub-type=By+sub-type">Ethiopia</a> and present-day <a href="https://ourworldindata.org/explorers/countries-in-conflict-data?region=Africa&country=~ERI&Measure=Conflict+deaths&Conflict+type=All+armed+conflicts&Conflict+sub-type=By+sub-type">Eritrea</a>.
Non-state and interstate conflicts were less deadly, each contributing fewer than 10% of deaths.
{.heading}
text: Middle East
level: 2
{}
Intrastate conflicts were the leading cause of conflict deaths in the Middle East, accounting for four in five deaths. <a href="https://ourworldindata.org/explorers/countries-in-conflict-data?country=~SYR&Measure=Conflict+deaths&Conflict+type=All+armed+conflicts&Conflict+sub-type=By+sub-type">Syria</a> was especially affected, alongside <a href="https://ourworldindata.org/explorers/countries-in-conflict-data?country=~IRQ&Measure=Conflict+deaths&Conflict+type=All+armed+conflicts&Conflict+sub-type=By+sub-type">Iraq</a> and <a href="https://ourworldindata.org/explorers/countries-in-conflict-data?country=~YEM&Measure=Conflict+deaths&Conflict+type=All+armed+conflicts&Conflict+sub-type=By+sub-type">Yemen</a>.
Non-state conflicts contributed to fewer deaths, around one in ten.
And one-sided violence and interstate conflicts accounted for even fewer deaths, with about one in twenty deaths each.
{.heading}
text: Asia and Oceania
level: 2
{}
Intrastate conflicts dominated Asia and Oceania even more, accounting for nearly 90% of conflict deaths between 1989 and 2024. <a href="https://ourworldindata.org/explorers/countries-in-conflict-data?country=~AFG&Measure=Conflict+deaths&Conflict+type=All+armed+conflicts&Conflict+sub-type=By+sub-type">Afghanistan</a> was most affected, experiencing several wars over the decades.
One-sided violence claimed most of the other deaths, making up almost one in ten deaths, while deaths in non-state and interstate conflicts were rare, resulting in around 3% and 1% of deaths.
{.heading}
text: Europe
level: 2
{}
Interstate conflicts were the leading causes of conflict deaths in Europe, accounting for around two-thirds of all fatalities.
Virtually all interstate conflict deaths were from a single war: Russia’s invasion of <a href="https://ourworldindata.org/explorers/countries-in-conflict-data?country=~UKR&Measure=Conflict+deaths&Conflict+type=All+armed+conflicts&Conflict+sub-type=By+sub-type">Ukraine</a> since 2022.
Intrastate conflicts account for around 30% of deaths. Many occurred in the early 1990s in Southeastern Europe, especially in <a href="https://ourworldindata.org/explorers/countries-in-conflict-data?country=~BIH&Measure=Conflict+deaths&Conflict+type=All+armed+conflicts&Conflict+sub-type=By+sub-type">Bosnia and Herzegovina</a>.
One-sided violence was responsible for around 5% of deaths, while non-state conflicts caused few deaths, making up less than 1% of deaths.
{.heading}
text: Americas
level: 2
{}
Non-state conflicts overshadowed other forms of conflict in the Americas, accounting for more than two-thirds of all deaths, primarily due to fighting between criminal organizations. <a href="https://ourworldindata.org/explorers/countries-in-conflict-data?country=~MEX&Measure=Conflict+deaths&Conflict+type=All+armed+conflicts&Conflict+sub-type=By+sub-type">Mexico</a> was most affected, with a large increase in conflict deaths in recent years.
Intrastate conflicts made up nearly a fifth of deaths, especially from conflict in <a href="https://ourworldindata.org/explorers/countries-in-conflict-data?country=~COL&Measure=Conflict+deaths&Conflict+type=All+armed+conflicts&Conflict+sub-type=By+sub-type">Colombia</a> in the late 1990s and early 2000s.
One-sided violence claimed about one in ten of all conflict deaths, while interstate conflicts were rarer than in any other world region, with fewer than 1,000 deaths in total.
[]
{}
```

## When to use

- Long-form text on the left that discusses a chart, image, or visual on
  the right — so the visual stays visible as the reader scrolls.
- Guided-chart sections where the chart is in the right column.

## When NOT to use

- Two roughly equal-weight blocks that should collapse at a narrower
  breakpoint — use `{.side-by-side}` instead.
- When the sticky side should be the left column — use `{.sticky-left}`.
