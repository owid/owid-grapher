Shows all Grapher charts that share a tag with the current article. "Key
charts" (those pinned via the admin) appear at the top; the `[.top]`
section lets you override or extend that ordering for this article.

```archie
{.all-charts}
heading: Interactive charts on homelessness
[.top]
url: https://ourworldindata.org/grapher/homelessness-rate-point-in-time-count
url: https://ourworldindata.org/grapher/homelessness-rate-flow-count
[]
{}
```

## When to use

- Topic pages that should surface every chart associated with the topic.

## When NOT to use

- You want to hand-pick a small number of related charts — use
  `{.chart-rows}` or `{.additional-charts}`.

## Properties

- `heading`: The section's heading text. When the document has a tag, the
  page shows "Key Charts on <tag name>" instead and this text is only used
  as a fallback for untagged docs. Required; without it the block is
  dropped.
- `top`: Charts to pin at the front of the listing, authored as a `[.top]`
  … `[]` section with one `url:` line per chart (a Grapher URL). Listed
  charts appear first, in the order given, ahead of the admin-pinned key
  charts. Omitted, the admin's key-chart ordering is used unchanged; an
  entry that isn't a `url:` line drops the block.

## Notes

The tag is set on the document in the gdocs admin index. URLs listed under
`[.top]` must belong to charts that share that tag.
