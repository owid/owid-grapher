---
exemplars:
    - the-median-age-in-china-has-rapidly-caught-up-with-the-united-kingdom
skeleton:
    - name: The image
      description:
          One static chart image — the insight is the chart. The title above
          it states the finding, not the topic.
      components: [image]
    - name: The point
      description:
          Two to four short paragraphs explaining the single pattern the
          chart shows. Nearly every published data insight is exactly this —
          image plus prose, nothing else.
      components: [text]
    - name: Call to action
      description: Optional closing cta linking to the interactive chart or the
          related topic page.
      components: [cta]
---

A short, chart-led observation: a single static image or chart and a few
paragraphs making one point. Published in the data-insights feed under
`/data-insights/{slug}`.

## When to use

- One interesting pattern in the data, explained in a few hundred words.

## When NOT to use

- Prefer `article` when the piece needs sections, multiple charts, or a
  narrative arc.

## Variations

- Set `grapher-url` when the insight is based on a live grapher chart,
  `narrative-chart` when it is based on a narrative chart, and `figma-url`
  to point at the Figma file for the static image.
