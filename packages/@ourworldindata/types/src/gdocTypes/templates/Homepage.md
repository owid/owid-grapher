---
exemplars:
    - owid-homepage
skeleton:
    - name: Pill row
      description: A small grey bar of links sitting at the top of the homepage,
          below the nav bar.
      components: [pill-row]
    - name: Homepage search
      description:
          A wide search-bar section. The nav's own search bar disappears on
          the homepage, so this component is required to replace it.
      components: [homepage-search]
    - name: Homepage intro
      description:
          A large block of links to OWID content plus hard-coded mission
          text — exactly 4 tiles.
      components: [homepage-intro]
    - name: Latest data insights
      description: A grey section showing a scroller of the latest 7 data
          insights. As editorial guidance, only add the block once at
          least 4 are published.
      components: [latest-data-insights]
    - name: Key indicator collection
      description: An accordion of key indicators, each linking to a datapage.
      components: [key-indicator-collection]
    - name: Explorer tiles
      description: A grid of links to tagged explorers.
      components: [explorer-tiles]
---

The single system-managed document that renders as the site's homepage,
built from several one-off components written specifically for it.

## When to use

- Only for the one document that is the site's homepage.

## When NOT to use

- Never for authored content — most of its components (homepage search,
  homepage intro, latest data insights, key indicator collection, explorer
  tiles) are platform blocks built specifically for the homepage, not
  general-purpose building blocks for other pages.
