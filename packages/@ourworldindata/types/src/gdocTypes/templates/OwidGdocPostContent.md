Field descriptions for the front matter of post-type gdocs (articles, topic
pages, linear topic pages, fragments). Joined into the template reference by
`devTools/gdocs/generate-gdocs-references.ts`, which fails if an entry here
does not match a field of `OwidGdocPostContent` — or if a non-derived field
is missing an entry.

- `title`: The document headline.
- `supertitle`: Kicker line shown above the title.
- `subtitle`: Standfirst shown below the title.
- `authors`: Comma-separated author names. Append a role in parentheses to
  credit a specific contribution — e.g. "Jane Doe (Editor), John Smith".
- `dateline`: The publication date as displayed under the byline, e.g.
  "June 30, 2026".
- `excerpt`: Short plain-text summary used in cards and link previews.
- `type`: The document type; decides the layout and where the document
  appears on the site.
- `body`: The document body: a sequence of ArchieML component blocks. See
  the components reference for every available block.
- `refs`: Footnote definitions for ID-based references, authored as a
  `[.refs]` block of `id:` + `[.+content]` entries. Inline
  `{ref}…{/ref}` footnotes need no entry here.
- `deprecation-notice`: One or more paragraphs shown in a banner marking the
  article as outdated, authored as a `[+deprecation-notice]` freeform block
  of text paragraphs.
- `latest-feed-featured-image`: Image filename that overrides
  `featured-image` on the /latest feed.
- `latest-feed-excerpt`: Rich-text excerpt (formatting and internal links
  allowed) shown on the /latest feed instead of `excerpt`, authored as a
  `[+latest-feed-excerpt]` freeform block of text paragraphs.
- `hide-citation`: Set to true to hide the "Cite this work" section at the
  end of the article.
- `cover-image`: Filename of the full-width image shown behind the header.
- `featured-image`: Filename of the image used in cards and social-media
  previews.
- `atom-title`: Title override for the document's atom-feed entry.
- `atom-excerpt`: Excerpt override for the document's atom-feed entry.
- `sidebar-toc`: Set to true to show a table of contents in the sidebar.
- `heading-variant`: Typography variant for the header: "heavy" or "light".
- `hide-subscribe-banner`: Set to true to hide the subscribe banner.
- `cover-color`: Named background color of the header area (one of the
  sdg-color-N values or "amber").
- `sticky-nav`: Navigation items pinned below the header, authored as a
  `[.sticky-nav]` array of `target:` (anchor) + `text:` (label) pairs.
  Linear topic pages get a default set generated automatically.
- `details`: Details-on-demand dictionary sourced from the details fragment.
  Not yet supported by the ArchieML write-back: documents using it must be
  edited in Google Docs directly.
- `faqs`: FAQ content consumed by data pages, authored in FAQ fragments.
  Not yet supported by the ArchieML write-back: documents using it must be
  edited in Google Docs directly.
