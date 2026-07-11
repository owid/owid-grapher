A callout whose text interpolates live values from a Grapher chart at the
`url`. Use `$latestTime()` and `$latestValue()` to pull the most recent
data point. For multi-y charts, pass a column name, e.g.
`$latestTime(emissions_total)`.

```archie
{.data-callout}
url: https://ourworldindata.org/grapher/life-expectancy?country=CAN
[.+content]
In $latestTime(), Canada's life expectancy was $latestValue()
[]
{}
```

## When to use

- Surfacing a "latest value" summary for a specific entity.
- Country profiles where copy should adapt to per-country data.

## When NOT to use

- Prefer `{.callout}` for static meta-textual notes not driven by chart
  data.

## Notes

Include `time` in the grapher URL to pin a specific period —
`$latestTime()` means "latest for this particular view". Use
/admin/callout-functions to find the indicator slugs a chart exposes.

If the referenced chart has no data for the current entity, the entire
section won't render — by design, useful for country profiles.

Any content can go inside, including charts, though a nested chart has no
programmatic relation to the callout.
