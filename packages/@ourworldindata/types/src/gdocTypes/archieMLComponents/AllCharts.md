Shows all Grapher charts that share a tag with the current article. "Key
charts" (those pinned via the admin) appear at the top; the `[.top]`
section lets you override or extend that ordering for this article.

### All charts on a topic with pinned top charts

```archie
{.all-charts}
heading: Interactive Charts on Poverty
[.top]
url: https://ourworldindata.org/grapher/size-poverty-gap-countries

url: https://ourworldindata.org/grapher/gdp-per-capita-maddison-2020
[]
{}
```

## When to use

- Topic pages that should surface every chart associated with the topic.

## When NOT to use

- You want to hand-pick a small number of related charts — use
  `{.chart-rows}` or `{.additional-charts}`.

## Notes

The tag is set on the document in the gdocs admin index. URLs listed under
`[.top]` must belong to charts that share that tag.
