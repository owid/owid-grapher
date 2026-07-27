# Plan: `display.referenceEntity`

_Re: [#5673](https://github.com/owid/owid-grapher/issues/5673) (highlight a
selected country on the map). Companion plan:
[indicator-annotation-plan.md](./indicator-annotation-plan.md)._

## Problem

Charts built on _relational_ indicators — data measured relative to one country
(migration to/from Afghanistan, imports from China as share of GDP) — need to
mark that reference country on the map. Its own value is "not applicable", and it
should be identifiable as the subject of the chart. Today this is hacked in with
mixed categorical + numeric data (Migration Flows; the main blocker for removing
mixed data types, owid-issues#2102) or sentinel values with a custom bin
(china-imports-as-share-of-gdp; nonsense values in table and downloads).

Explorers are out of scope (being discontinued); this targets Grapher and mdims.

## Proposal

```yaml
display:
    referenceEntity: China
```

One string naming the entity the indicator's data is relative to. Pure semantics —
no labels or colors are stored; Grapher owns all rendering:

- **Map**: solid dark neutral gray fill (≈ `GRAY_90` `#4e4e4e`) + own legend entry.
- **Tooltip / table tab**: "Not applicable" (fixed string).
- **Downloads**: empty cell.

## Decisions

- **Semantic field, no stored presentation.** Keeps rendering consistent
  site-wide, makes "Not applicable" vs. "No data" derivable everywhere.
- **Indicator metadata, not chart config.** The reference country is a fact about
  the indicator, not about a chart.
- **Why the `display` bag**: precedent — `display` already holds semantic facts
  Grapher interprets (`isProjection`, `zeroDay`, `timeInterval`, `tolerance`),
  and `isProjection` has the identical shape: semantic flag in, Grapher-owned
  rendering out. Also no DB/API changes (existing JSON column).
- **Singular** — a relational indicator has exactly one reference.
- **Not built on focus or selection** — those are ephemeral/user-mutable; this is
  an authored, permanent property.
- **Time-invariant by construction.** The reference entity is part of the
  indicator's identity — "emigrants from Afghanistan" is about Afghanistan for
  every year the indicator covers.
- **Wins over stray values**: any leftover sentinel value (`-1`) for the entity
  is discarded, so the feature ships before data cleanup.
- **Legend defaults to the entity name**; "Selected country" is wrong outside
  interactive contexts and "Reference country" is internal jargon. The tooltip's
  "Not applicable" explains the missing value on hover.
- **Presentation overrides via the existing colorScale mechanism.** Grapher
  injects a categorical bin for the reference entity, exactly like the "No data"
  bin — so `map.colorScale.customCategoryLabels` / `customCategoryColors`, keyed
  by entity name, override label and color per chart with no new config field.

## Relation to indicator annotations and `entityAnnotationsMap`

[#5673](https://github.com/owid/owid-grapher/issues/5673) originally asked for
one per-entity metadata format also covering indicator annotations
([#5143](https://github.com/owid/owid-grapher/issues/5143)). But the concepts differ: the annotation fields
(`entityAnnotationsMap` per entity, `display.annotation` per indicator)
carry free text that Grapher prints under series labels, while `referenceEntity` is a semantic fact that
Grapher interprets, rendered on the map, table and tooltip — never on series
labels. Three narrow scalar fields need no shared schema; an `entities: {}` map
only becomes worthwhile if a second per-entity _semantic_ ever appears.
