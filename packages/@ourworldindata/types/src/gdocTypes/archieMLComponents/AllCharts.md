Lists the Grapher charts tagged with the document's topic tag. The block
needs a tag on the document (set in the gdocs admin index). Without one it
shows an error in place of the list. The block is written empty and nothing
is configurable from the doc. The heading reads "Key charts on <tag name>",
built from the document's first tag ("Key Charts" on topic pages).

```archie
{.all-charts}
{}
```

## When to use

- Topic pages that should surface every chart associated with the topic.

## When NOT to use

- You want to hand-pick a small number of related charts — use
  `{.chart-rows}` or `{.additional-charts}`.
