---
title: Country profile placeholders
category: Charts & data
---

A country profile is written once and instantiated for every entity in
its scope. Codewords in the body get replaced with that entity's name,
code, or phrasing variant each time the page is baked.

See `{template:profile}` for the front-matter fields that define a
profile's scope.

```archie
$EntityName’s population has grown steadily since 1950.

{.chart}
url: https://ourworldindata.org/grapher/population?country=$entityCode
{}
```

## Placeholders

- `$entityName`: the entity's name, with an article where English needs
  one — "Australia", "the United Kingdom". Use it mid-sentence.
- `$EntityName`: the same, capitalized for the start of a sentence —
  "Australia", "The United Kingdom".
- `$noArticleEntityName`: the bare name with no article — "Australia",
  "United Kingdom". Use it where an article would read wrong, e.g. linking
  to a search page with a country filter applied.
- `$entityCode`: the entity's code — "AUS", "GBR" for countries, an
  `OWID_`-prefixed code for continents. Use it in chart query params, e.g.
  `country=$entityCode`.

`$entityName`, `$EntityName` and `$noArticleEntityName` each also have a
possessive form, written with an apostrophe-s the way Google Docs types it
(a curly apostrophe, e.g. `$entityName’s`) — not a straight one. There is no
possessive form for `$entityCode`.

## Scope and exclude

Which entities a profile is instantiated for, and which specific ones to
leave out, are front-matter fields — see `{template:profile}` for
`scope` and `exclude`. Entities are matched by name, not by code — a
comma-separated list can name `countries`, `continents`, `all`, or the
name of one specific entity. A few codes work too, but only because
they happen to be registered variant names, e.g. `USA`.

## Not baked without data

A profile built around `{.data-callout}` blocks may end up with some,
all, or none of them renderable for a given entity, depending on data
availability — see `{guide:data-callout-functions}`. Say a profile has
ten callouts:

- All ten render for the UK — the page bakes, every section shows.
- Four of the ten render for Somalia — the page bakes, the other six
  sections are hidden.
- None render for Kosovo — the page isn't baked for Kosovo at all.
