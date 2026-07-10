A container wrapping one or more `{.data-callout}` blocks (and any
surrounding headings/text) so they hide together when none of the child
callouts have data for the current entity. If every callout in the group
ends up empty for a given country/audience, the whole group — heading
included — disappears.

```archie
{.data-callout-group}
[.+content]
{.heading}
text: Life expectancy and child mortality
level: 2
{}

{.data-callout}
url: https://ourworldindata.org/grapher/life-expectancy?country=CAN
[.+content]
In $latestTime(), Canada's life expectancy was $latestValue()
[]
{}

{.data-callout}
url: https://ourworldindata.org/grapher/child-mortality?country=CAN
[.+content]
In $latestTime(), child mortality in Canada was $latestValue()
[]
{}
[]
{}
```

## When to use

- On country profiles where a section heading should only appear if at
  least one of its `{.data-callout}` children actually has data.
- To keep a heading and a set of related data callouts visually and
  logically grouped.

## When NOT to use

- For a single callout — use a bare `{.data-callout}` instead.
- When each callout should hide independently — the whole group hides or
  shows as a unit.

## Notes

Only useful when the content contains at least one `{.data-callout}` —
otherwise the visibility filtering has nothing to act on.
