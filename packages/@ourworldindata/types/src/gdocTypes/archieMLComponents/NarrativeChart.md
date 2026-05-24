A chart derivative that can only be viewed inside an article. Narrative
charts are the preferred way of embedding charts in articles — they let
you pin the title, country selection, time range, and chart type so that
future data updates don't change the point being made.

## When to use
- The chart is making a specific argument and the selection/title matters.
- You want editorial control independent of the underlying Grapher config.

## When NOT to use
- The reader is meant to freely explore — use `{.chart}` instead.
- For explorers or MDIMs — narrative charts don't wrap those; use `{.chart}`.

## Variations
- `size`: `narrow` | `wide` (default) | `widest`.

### Basic

```archie
{.narrative-chart}
name: global-life-expectancy-has-doubled
{}
```
