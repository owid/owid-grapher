A carousel of charts, each paired with a narrative caption and a block
of technical text shown below the chart.

## When to use

- Telling a step-by-step story across several views of the same (or
  related) charts, where each step needs its own prose and technical notes.

## When NOT to use

- A simple list of alternative chart views — use `{.chart-rows}`.
- A single chart with inline narration — use `{.guided-chart}`.

### Two-slide chart story

```archie
[.chart-story]
narrative: Text for slide 1, an overview of the world
chart: https://ourworldindata.org/grapher/military-expenditure-share-gdp
{.technical}
The poverty gap index is a measure that reflects both the depth and prevalence of poverty.
Extreme poverty is defined as living below the international poverty line of $1.90 per day
{}

narrative: Slide two looks at Africa
chart: https://ourworldindata.org/grapher/military-expenditure-share-gdp?region=Africa
{.technical}
Data is measured in international-$.
{}
[]
```
