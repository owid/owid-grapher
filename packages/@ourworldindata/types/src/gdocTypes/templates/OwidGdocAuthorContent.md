<!--
Field descriptions for the front matter of author pages. Joined into the
template reference by `devTools/gdocs/generate-gdocs-references.ts`, which
fails if an entry here does not match a field of `OwidGdocAuthorContent` —
or if a non-derived field is missing an entry.
-->

- `type`: The document type; decides the layout and where the document
  appears on the site.
- `title`: The author's name exactly as it's spelled in the `authors` field
  of their articles — used to filter and populate the "Latest work" section
  of the `{.research-and-writing}` block below.
- `role`: The author's role, shown under their name.
- `bio`: The author's biography, authored as a `[.+bio]` freeform block of
  text paragraphs.
- `socials`: Links to the author's social/contact profiles, authored as a
  `[socials]` array of `url:` + `text:` + `type:` entries. See
  `{.socials}`.
- `featured-image`: Filename of the author's profile picture.
- `authors`: Comma-separated author names for the page's own byline (usually
  just the author themselves).
- `body`: The page body, in one of two layouts — see the template overview
  above: a `{.pill-row}` of topics followed by a `{.research-and-writing}`
  "Featured work" block, or a single `{.research-and-writing}` "All work"
  block on its own.
