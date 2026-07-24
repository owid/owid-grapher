# Programmatic article authoring

Scripts for writing OWID articles from the command line, without Google Docs.
The gdoc is only the transport for ArchieML text — `archieToEnriched()` parses
plain text directly, so articles can be drafted, previewed, and iterated on as
local text files backed by nothing but a `posts_gdocs` row.

All scripts run from the repo root with `tsx --tsconfig tsconfig.tsx.json` and
use the database credentials from `.env`.

## Workflow

1. Write an article as plain-text ArchieML (see `exampleArticle.archieml`).
   Headings are literal `{.heading}` blocks, inline formatting is literal HTML
   (`<b>`, `<i>`, `<a href>`), charts are `{.chart}` blocks — the same block
   vocabulary as in Google Docs. For the full syntax, export any existing
   article gdoc as plain text.

2. Ingest it into `posts_gdocs` under an arbitrary id (re-run to update):

    ```sh
    tsx --tsconfig tsconfig.tsx.json devTools/articleAuthoring/ingestArchieml.ts draft.archieml my-draft-id
    ```

3. Preview it in the admin at
   `/admin/gdocs/my-draft-id/preview?contentSource=internal`. The
   `contentSource=internal` parameter makes the preview read the stored
   version from the database; without it, the preview re-fetches the document
   from Google and fails for ids that aren't real gdocs.

Alternatively, render a draft to a standalone HTML page without the admin:

```sh
tsx --tsconfig tsconfig.tsx.json devTools/articleAuthoring/renderGdocPreview.tsx my-draft-id preview.html
```

Serve the file over http (e.g. `python3 -m http.server`) — in dev, styles load
through the vite dev server and are CORS-blocked for `file://` pages.
