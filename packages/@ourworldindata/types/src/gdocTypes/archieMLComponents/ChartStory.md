A carousel of charts, each paired with a narrative caption and a block
of technical text shown below the chart.

```archie
[.chart-story]
narrative: Share of women who were married by age 15
chart: https://ourworldindata.org/grapher/women-married-by-age-15
{.technical}
[.list]
[]
{}
narrative: Share of women who were married by age 18
chart: https://ourworldindata.org/grapher/women-married-by-age-18
{.technical}
[.list]
[]
{}
[]
```

## When to use

- Telling a step-by-step story across several views of the same (or
  related) charts, where each step needs its own prose and technical notes.

## When NOT to use

- A simple list of alternative chart views — use `{.chart-rows}`.
- A single chart with inline narration — use `{.guided-chart}`.
