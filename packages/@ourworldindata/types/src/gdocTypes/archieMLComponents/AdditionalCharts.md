A subtle way of linking to multiple charts — each line of body becomes a
separate item, typically a link to a chart.

## When to use

- Offering readers a small set of related charts without giving them
  visual prominence.

## When NOT to use

- You want thumbnails or descriptions per item — use `{.chart-rows}`.
- You need a full-page listing of all charts on a topic — use
  `{.all-charts}` on a topic page.

## Properties

- `items`: The list entries themselves — each bullet of a Google-Docs
  bulleted list placed between `{.additional-charts}` and `{}` becomes one
  item. Rich text: links and formatting survive, and each entry is
  typically a linked chart title. The content must be a true bulleted list
  in the doc; plain text lines (or writing the tag as
  `[.additional-charts]`) drop the block with a parse error.

## Notes

Because the list structure comes from Google Docs layout, not pure
ArchieML text, this component has no standalone `@example`.
