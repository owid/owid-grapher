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

## Properties

- `items`: The story's steps — the block is itself authored as a
  `[.chart-story]` … `[]` array, one entry per slide. Each entry carries a
  `narrative:` (the slide's headline sentence, rich text, shown large next
  to the chart), a `chart:` (the Grapher URL to show for that slide), and
  optionally a `{.technical}` object holding a `[.list]` … `[]` bulleted
  list of technical notes shown under the chart beneath an "About this
  chart" label. An entry missing `narrative:` or `chart:` (or writing the
  technical tag as `[.technical]`) is dropped from the carousel.
