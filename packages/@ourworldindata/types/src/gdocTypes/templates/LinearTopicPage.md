---
exemplars:
    - religion
skeleton:
    - name: Opening
      description:
          A short untitled introduction, often followed by featured-metrics
          or an ltp-toc when the page is long.
      components: [text, featured-metrics, ltp-toc]
    - name: Sections
      repeats: true
      description:
          Level-1 headings drive the page's sticky navigation; each section
          reads as essay prose with the topic's charts woven in.
      components: [heading, text, chart, image, list, all-charts]
    - name: Closing
      description: Optional endmatter — an explore-data-section pointing at the
          topic's explorer, related reading via recirc or prominent links.
      components: [explore-data-section, recirc, prominent-link]
---

A topic entry page that reads as one continuous essay rather than a modular
grid. Gets a sticky navigation generated from its headings (override with
`sticky-nav`). Published under `/{slug}`.

## When to use

- A topic whose content is best presented as a single narrative flow.

## When NOT to use

- Prefer `topic-page` for modular topic pages composed of self-contained
  sections.
