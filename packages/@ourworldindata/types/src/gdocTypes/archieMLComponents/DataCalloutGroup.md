A container wrapping one or more `{.data-callout}` blocks (and any
surrounding headings/text) so they hide together when none of the child
callouts have data for the current entity. If every callout in the group
ends up empty for a given country/audience, the whole group — heading
included — disappears.

## When to use

- On country profiles where a section heading should only appear if at
  least one of its `{.data-callout}` children actually has data.
- To keep a heading and a set of related data callouts visually and
  logically grouped.

## When NOT to use

- For a single callout — use a bare `{.data-callout}` instead.
- When each callout should hide independently — the whole group hides or
  shows as a unit.

## Variations

- `content` is an array of any enriched blocks, but it's only useful when
  it contains at least one `{.data-callout}` (otherwise the visibility
  filtering has nothing to act on).

```archie
{.data-callout-group}
[.+content]
{.text}
## Population
{}

{.data-callout}
title: Total population
value: {{population}}
{}

{.data-callout}
title: Population density
value: {{population_density}}
{}
[]
{}
```
