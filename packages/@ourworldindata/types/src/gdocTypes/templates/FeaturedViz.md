---
skeleton:
    - name: The intro
      description:
          Optional short paragraph above the viz — a sentence or two on what
          the reader is looking at. Everything before the featured viz
          renders in the text column under the header.
      components: [text]
    - name: The featured viz
      description:
          The first bespoke-component block in the body is the page's hero,
          rendered on its own full-bleed band. When the bundle publishes
          metadata, a methods box sits beside it. Any later bespoke-component
          block renders inline like an ordinary block.
      components: [bespoke-component]
    - name: The explanation
      description:
          Prose and headings below the band — what the viz shows, how to read
          it, where the data comes from.
      components: [text, heading]
---

A page built around one custom, interactive data visualization: a bespoke
component on a full-bleed hero band, with prose above and below it. Published
under `/featured-viz/{slug}`.

## When to use

- Presenting a single `{.bespoke-component}` as the page itself, rather than
  as one block inside a longer piece.

## When NOT to use

- Prefer `{template:article}` when the visualization supports a narrative
  with sections and several charts — an article embeds the same
  `{.bespoke-component}` inline.
- Prefer `{template:data-insight}` for a short, chart-led observation around
  a static image.

## Notes

The hero is the first `{.bespoke-component}` in the body. The page keeps the
viz's state in the URL, and when the bundle publishes metadata (origins or a
description key) that metadata renders as a methods box beside the hero
instead of the component's own metadata modal.
