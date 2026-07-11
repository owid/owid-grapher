Field descriptions for the front matter of announcements. Joined into the
template reference by `devTools/gdocs/generate-gdocs-references.ts`, which
fails if an entry here does not match a field of
`OwidGdocAnnouncementContent` — or if a non-derived field is missing an
entry.

- `title`: The announcement headline, stating the news directly — e.g.
  "Explore updated data on prison populations worldwide".
- `excerpt`: One sentence summarizing the news, shown in the /latest feed
  and in link previews.
- `authors`: Comma-separated author names. Append a role in parentheses to
  credit a specific contribution — e.g. "Jane Doe (Editor)".
- `featured-image`: Filename of the image used in link previews. Published
  announcements rarely set one — the image in the body serves that role.
- `kicker`: Short category label shown above the headline — "Data update",
  "Topic update", "Website upgrade", or "Announcement". Its slugified form
  buckets the announcement on /latest; unrecognized values are rejected at
  publish time.
- `body`: The announcement body: a few short paragraphs, usually a closing
  cta, and often one image.
- `type`: Always "announcement".
- `cta`: Nested { text, url } link for the empty-body, homepage-carousel
  variant of announcement.
