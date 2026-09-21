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
    - name: Sections
      repeats: true
      description: Each section opens with a heading and mixes prose with data
          callouts that adapt to the instantiated entity — usually built
          around a chart per callout.
      components: [heading, text, data-callout, chart]
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

A profile where every `{.data-callout}` fails to render for a given entity
(no data at all) is not baked for that entity; a profile where only some
callouts render is baked with the empty ones hidden. See
`{guide:profile-placeholders}`.
