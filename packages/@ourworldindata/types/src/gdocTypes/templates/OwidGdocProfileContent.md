<!--
Field descriptions for the front matter of country-profile templates.
Joined into the template reference by
`devTools/gdocs/generate-gdocs-references.ts`, which fails if an entry here
does not match a field of `OwidGdocProfileContent` — or if a non-derived
field is missing an entry.
-->

- `type`: The document type; decides the layout and where the document
  appears on the site.
- `title`: The document headline, with `$entityName`-style placeholders
  substituted per instantiated entity.
- `authors`: Comma-separated author names.
- `scope`: A comma-separated list that decides which entities the template
  is instantiated for. Each item is either `countries` (every country),
  `continents` (every continent), `all` (every country and continent), or
  the name of one specific entity, e.g. `China, North America`. Mixing the
  generic keywords with specific entities in the same list is allowed. A
  few codes work too, but only because they happen to be registered
  variant names, e.g. `USA`.
- `exclude`: A comma-separated list of specific entity names to leave out
  of `scope`, e.g. `Vatican City, Christmas Island`.
- `subtitle`: Standfirst shown below the title.
- `excerpt`: Short plain-text summary used in cards and link previews.
- `featured-image`: Filename of the image used in cards and social-media
  previews.
- `sidebar-toc`: Set to true to show a table of contents in the sidebar.
- `sidebar-toc-h1-only`: Set to true to limit the sidebar table of
  contents to top-level headings.
- `body`: The document body: a sequence of ArchieML component blocks,
  usually built around `{.data-callout}` blocks that adapt to the
  instantiated entity. See the components reference for every available
  block.
- `refs`: Footnote definitions for ID-based references, authored as a
  `[.refs]` block of `id:` + `[.+content]` entries. Inline
  `{ref}…{/ref}` footnotes need no entry here. See `{guide:refs}`.
