Field descriptions for the front matter of data insights. Joined into the
template reference by `devTools/gdocs/generate-gdocs-references.ts`, which
fails if an entry here does not match a field of
`OwidGdocDataInsightContent` — or if a non-derived field is missing an entry.

- `title`: The insight headline.
- `authors`: Comma-separated author names. Append a role in parentheses to
  credit a specific contribution — e.g. "Jane Doe (Editor)".
- `narrative-chart`: Name of the narrative chart the insight is based on.
- `grapher-url`: URL of the grapher chart the insight is based on.
- `figma-url`: URL of the Figma file holding the insight's static image.
- `body`: The insight body: typically one image and a handful of short text
  paragraphs.
- `type`: Always "data-insight".
