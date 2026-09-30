<!--
Field descriptions for the front matter of about pages. Joined into the
template reference by `devTools/gdocs/generate-gdocs-references.ts`, which
fails if an entry here does not match a field of `OwidGdocAboutContent` — or
if a non-derived field is missing an entry.
-->

- `type`: The document type; decides the layout and where the document
  appears on the site. Set to `type: about-page` (see `{template:about-page}`)
  to signify that a document belongs to the about-pages sub-navigation.
- `title`: The document headline. By default about pages render with the
  fixed title "About" regardless of this field — see `override-title`.
- `excerpt`: Short plain-text summary used in cards and link previews.
- `featured-image`: Filename of the image used in cards and social-media
  previews.
- `authors`: Comma-separated author names.
- `hide-nav`: Set to true to hide the about-section sub-navigation on this
  page.
- `override-title`: About pages render with the fixed title "About" by
  default, even when `title` is set (used in the gdocs index page in the
  admin); set this to true to use `title` on the page itself too.
- `body`: The page body: a sequence of ArchieML component blocks. About
  pages behave like normal articles but with a few dedicated components —
  see `{.donors}`, `{.people}`, `{.people-rows}` and `{.person}` — that are
  not expected to be used outside about pages.
- `refs`: Footnote definitions for ID-based references, authored as a
  `[.refs]` block of `id:` + `[.+content]` entries. Inline
  `{ref}…{/ref}` footnotes need no entry here. See `{guide:refs}`.
