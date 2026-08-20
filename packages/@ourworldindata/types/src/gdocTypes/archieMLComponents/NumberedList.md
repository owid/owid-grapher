An ordered (numbered) list. Unlike unordered lists — which are derived
from Google Docs bullet formatting — numbered lists must be declared
explicitly in ArchieML. Nested lists are not supported.

```archie
[.numbered-list]
* 0. Collect the data that is relevant
* 1. Make the data comparable
* 2. Clearly document the data
* 3. Share the data frequently and promptly
* 4. Publish the data at a stable location
* 5. Choose a reusable data format
* 6. License others to reuse the data
[]
```

## Properties

- `items`: The list entries — one per `*` line inside the
  `[.numbered-list]` block, keeping rich text (bold, italic, links).
  Write the `*` yourself and don't let Google Docs convert the lines
  into its own bullet formatting. A leading number like `1.` after the
  `*` is stripped; the published page numbers the items automatically.
