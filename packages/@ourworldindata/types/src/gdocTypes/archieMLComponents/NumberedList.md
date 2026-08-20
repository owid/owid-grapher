An ordered (numbered) list. Unlike unordered lists — which are derived
from Google Docs bullet formatting — numbered lists must be declared
explicitly in ArchieML. Nested lists are not supported.

```archie
[.numbered-list]
* Collect the data that is relevant
* Make the data comparable
* Clearly document the data
* Share the data frequently and promptly
* Publish the data at a stable location
* Choose a reusable data format
* License others to reuse the data
[]
```

## Properties

- `items`: The list entries — one per `*` line inside the
  `[.numbered-list]` block, keeping rich text (bold, italic, links).
  Write the `*` yourself and don't let Google Docs convert the lines
  into its own bullet formatting. A number typed after the `*` (e.g.
  `* 1. …`) is ignored; the page numbers items itself.
