<!--
Field descriptions for the front matter of the homepage. Joined into the
template reference by `devTools/gdocs/generate-gdocs-references.ts`, which
fails if an entry here does not match a field of `OwidGdocHomepageContent` —
or if a non-derived field is missing an entry.
-->

- `type`: The document type; decides the layout and where the document
  appears on the site. Set to `type: homepage` (see `{template:homepage}`) to
  mark the single document that renders as the site's homepage.
- `title`: The document title. Not displayed on the homepage itself.
- `authors`: Comma-separated author names.
- `body`: The page body: the homepage's one-off components, in the order
  they should appear — see `{.pill-row}`, `{.homepage-search}`,
  `{.homepage-intro}`, `{.latest-data-insights}`,
  `{.key-indicator-collection}` and `{.explorer-tiles}`.
