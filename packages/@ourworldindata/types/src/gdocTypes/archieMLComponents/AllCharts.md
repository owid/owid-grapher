Lists every chart tagged with the document's first topic tag. The block needs
a tag on the document (set in the gdocs admin index). The block is written empty and nothing is
configurable from the doc.

The charts come from Algolia, the site search's charts index, ordered by search score.

The heading reads "All charts on <tag name> (N charts)". Each row shows the chart title, variant and source line. It also
shows up to three tab thumbnails that switch the live chart preview.

```archie
{.all-charts}
{}
```

## When to use

- Topic pages that should surface every chart associated with the topic.

## When NOT to use

- You want to hand-pick a small number of related charts — use
  `{.chart-rows}` or `{.additional-charts}`.
