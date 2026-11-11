Lists every chart and multi-dim view tagged with any of the document's tags. The block needs at least one tag on the document (set in the admin).

The charts and multi-dim views come from Algolia, picked and ordered as the site search does (explorer views are left out).

The heading reads "All charts on <first tag's name> (N charts)". Each row shows the chart title, its variant name and its source line. It also shows up to three tab thumbnails that switch the live chart preview.

```archie
{.all-charts}
{}
```

## When to use

- Topic pages that should surface every chart associated with the topic.

## When NOT to use

- You want to hand-pick a small number of related charts — use
  `{.chart-rows}` or `{.additional-charts}`.
