<!--
Field descriptions for the front matter of featured-viz pages. Joined into
the template reference by `devTools/gdocs/generate-gdocs-references.ts`,
which fails if an entry here does not match a field of
`OwidGdocFeaturedVizContent` — or if a non-derived field is missing an entry.
-->

- `title`: The page headline, shown above the featured viz.
- `subtitle`: Standfirst shown below the title.
- `authors`: Comma-separated author names. Append a role in parentheses to
  credit a specific contribution — e.g. "Jane Doe (Editor)".
- `dateline`: The publication date as displayed under the byline, e.g.
  "June 30, 2026". Omitted, the page shows the publish date.
- `excerpt`: Short plain-text summary used in cards and link previews.
- `featured-image`: Filename of the image used in cards and social-media
  previews — the viz needs JavaScript, so it cannot stand in for one.
- `hide-citation`: Set to true to hide the "Cite this work" section at the
  end of the page and the page citation in the methods box.
- `body`: The page body: the featured viz and the prose around it. The first
  `{.bespoke-component}` block is the hero; see the template skeleton.
- `refs`: Footnote definitions for ID-based references, authored as a
  `[.refs]` block of `id:` + `[.+content]` entries. Inline `{ref}…{/ref}`
  footnotes need no entry here. See `{guide:refs}`.
- `type`: Always "featured-viz".
