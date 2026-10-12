---
exemplars:
    - co2
skeleton:
    - name: Opening
      description: Introductory text with entity placeholders (`$entityName`,
          `$EntityName`, `$noArticleEntityName`, `$entityCode`) so the copy
          reads naturally once instantiated for a specific country or
          continent.
      components: [text]
    - name: At a glance
      description: Optionally, a grid of ranking cards showing where the
          entity ranks among all countries on a handful of key indicators.
      components: [ranking-cards]
    - name: Sections
      repeats: true
      description: Each section opens with a heading and mixes prose with data
          callouts that adapt to the instantiated entity — usually built
          around a chart per callout. Peer rankings and comparisons show how
          the entity compares with its neighbours, region and income group.
      components:
          [heading, text, data-callout, chart, peer-ranking, peer-comparison]
---

A page format written once as a template and instantiated for every
country/continent in its `scope` — one published page per entity, each
with its own placeholders resolved.

## When to use

- A topic-shaped page that should exist once per country, e.g. "CO₂ and
  Greenhouse Gas Emissions in $entityName".

## When NOT to use

- A page that doesn't vary per entity — use `{template:article}` or `{template:topic-page}`
  instead.

## Notes

A profile where every `{.data-callout}` and ranking block
(`{.ranking-cards}`, `{.peer-ranking}`, `{.peer-comparison}`) fails to
render for a given entity (no data at all) is not baked for that entity; a
profile where only some of them render is baked with the empty ones
hidden. See `{guide:profile-placeholders}`.

Ranking blocks only rank countries: for a continent or other region, they
are hidden.
