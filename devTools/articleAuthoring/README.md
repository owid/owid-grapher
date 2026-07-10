# Programmatic article authoring

Scripts for writing OWID articles from the command line, without touching
Google Docs during drafting. The gdoc is only the transport for ArchieML text —
`archieToEnriched()` parses plain text directly, so drafts can be iterated on
locally and a real Google Doc created once at the end for human review.

All scripts run from the repo root with `tsx --tsconfig tsconfig.tsx.json` and
use the database and Google credentials from `.env`.

## Drafting loop (no Google involved)

1. Write an article as plain-text ArchieML (see `exampleArticle.archieml`).
   Headings are literal `{.heading}` blocks, inline formatting is literal HTML
   (`<b>`, `<i>`, `<a href>`), charts are `{.chart}` blocks — the same block
   vocabulary as in Google Docs. For the full syntax, export any existing
   article gdoc as plain text.

2. Ingest it into `posts_gdocs` under an arbitrary id (re-run to update):

    ```sh
    tsx --tsconfig tsconfig.tsx.json devTools/articleAuthoring/ingestArchieml.ts draft.archieml my-draft-id
    ```

3. Render it from the DB to a standalone HTML page:

    ```sh
    tsx --tsconfig tsconfig.tsx.json devTools/articleAuthoring/renderGdocPreview.tsx my-draft-id preview.html
    ```

    Serve the file over http (e.g. `python3 -m http.server`) — in dev, styles
    load through the vite dev server and are CORS-blocked for `file://` pages.
    The admin preview pages can't be used here: they always re-fetch the
    document from Google and 404 on ids that aren't real gdocs.

## Handoff to authors

When a draft is ready for review, create a real Google Doc from it. This
creates the doc via the service account (in `GDOCS_BACKPORTING_TARGET_FOLDER`),
inserts the ArchieML text, optionally shares it, and registers it through the
same ingestion pipeline the admin's "Add document" button uses:

```sh
tsx --tsconfig tsconfig.tsx.json devTools/articleAuthoring/createGdocArticle.ts draft.archieml "Article title" someone@ourworldindata.org
```

From there the normal editorial workflow applies (editing in Google Docs,
admin preview, publishing).
