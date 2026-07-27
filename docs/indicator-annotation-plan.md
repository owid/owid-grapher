# Plan: `display.annotation`

_Re: [#5143](https://github.com/owid/owid-grapher/issues/5143) (indicator
annotations in multi-indicator line charts). Companion plan:
[reference-entity-plan.md](./reference-entity-plan.md)._

## Problem

In charts whose series are entities, `display.entityAnnotationsMap` renders
explanatory text as a second line under a series label (e.g. what "Western
Offshoots" means). Multi-indicator charts label their series by _indicator_, and
there is no equivalent way to annotate those.

## Proposal

```yaml
display:
    annotation: Includes emissions from land-use change
```

Free-text annotation for the indicator, shown as a second line under its series
label in multi-indicator charts — the treatment entity series already get from
`entityAnnotationsMap`.

## Decisions

- **Indicator-keyed, not per-entity.** #5143 was framed as per-entity metadata,
  but an annotation on an indicator series has no entity dimension. Recognizing
  this decomposes #5673 + #5143 into two independent scalar fields and dissolves
  the "scalable per-entity format" problem.
- **Sibling of `display.name`** — context about what the indicator measures.
- **Per-chart authoring comes free**: a field in the chart admin's dimension
  editor (exactly what #5143 asks for) is just a `dimensions[].display` override.
- **Rendering exists**: the `SeriesAnnotation` machinery only needs an
  indicator-keyed source next to the entity-keyed one.

## Open questions

- Which chart types show `display.annotation` — line charts only at first, or all
  chart types whose series are indicators?
