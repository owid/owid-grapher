# Editing gdocs as ArchieML over the admin API

Authors write our content in Google Docs using ArchieML. These admin API
routes expose a gdoc as plain ArchieML text so that an agent (or any HTTP
client) can read, validate, edit and create documents without a repo
checkout, Google credentials or a client-side parser. All validation and all
writing to Google Docs happen server-side, behind the normal admin auth
(Tailscale identity or a Bearer admin API key).

This is a proof of concept: it favours refusing a write over writing something
lossy. See [Limitations](#limitations).

## Routes

| Route                                 | What it does                                                                                                                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/api/gdocs/:id/archie`     | The doc as canonical ArchieML — the exact text the ingestion pipeline parses — plus `revisionId`, `title`, `registered`, `published`. Side-effect-free (unlike `GET /gdocs/:id?contentSource=gdocs`, which syncs images and persists). |
| `PUT /admin/api/gdocs/:id/archie`     | Wholesale-replaces the doc's content with real Google formatting. Body `{ archieMl, expectedRevisionId }`. `?dryRun=true` validates only.                                                                                              |
| `POST /admin/api/gdocs`               | Creates a doc from ArchieML in a shared Drive folder (`folderId` or `GDOCS_AGENT_DRAFTS_FOLDER`) and registers it in the admin. Same gate, same `?dryRun=true`.                                                                        |
| `GET /admin/api/gdocs/:id/validation` | The stored doc's validation report exactly as the admin computes it: `{ publishable, errors, warnings }`.                                                                                                                              |

The write refuses, in order, each with a structured error:

1. **400** — the text fails the gate below (`writable: false`, `errors`, `warnings`).
2. **400** — a `:skip` / `:ignore` directive in the _middle_ of the doc. Hidden
   content there has no stable anchor after a full replace. Leading and
   trailing skip blocks (e.g. the "Preview" link atop most docs) are preserved
   verbatim — see `db/model/Gdoc/archieMlSkipBlocks.ts`.
3. **404** doc not registered · **403** doc published · **409**
   `expectedRevisionId` is stale (the author edited since the read).

After a successful write the doc is read back and compared at the parse level
(Google normalises style runs, so bytes are not compared), re-ingested so the
admin preview is current, and the response carries `previewUrl` plus the saved
doc's validation report.

Each response describes exactly one artifact: dry runs and 400s judge _the
submitted text_ (`writable`); `GET …/validation` and write successes describe
_the stored doc_ (`publishable`, errors block publishing, warnings never do).

## The gate

`validateArchieMl` in `db/model/Gdoc/validateArchieMl.ts` composes the
pipeline's own primitives:

1. `archieToEnriched` — throws on an unknown block; that becomes one error.
2. Collect the non-fatal `parseErrors` the parser attached to blocks (body and
   ref contents), split into errors and warnings, via `getParseFindings` — the
   same function the admin UI uses.
3. **Fixed point**: serialise the parsed content back to ArchieML with the
   write-back generator and re-parse. ArchieML's `load()` never errors, so a
   typo'd marker or an unclosed `[.list]` silently swallows content; the only
   signal is that the re-parse differs. Body blocks, refs and every top-level
   front-matter key are compared.
4. `type` must be one the write-back can serialise: `article`, `topic-page`,
   `linear-topic-page`, `fragment`, `data-insight`.

Front-matter keys dropped or altered by the round trip are classified against
the `OWID_GDOC_*_CONTENT_KEY_KINDS` consts in
`packages/@ourworldindata/types/src/gdocTypes/Gdoc.ts` and
`OWID_GDOC_ADMIN_MANAGED_KEYS`:

- **authored** key the serialiser doesn't emit yet (`faqs`, `details`) →
  refused, "not yet supported"
- **authored** key that comes back altered → refused
- **computed** key (`toc`, `authorRoles`, …) → warning, it is regenerated
- **admin-managed** (`slug`, `tags`, `publishedAt`, …) → warning telling the
  agent to relay the change to a human rather than invent front matter
- anything else (e.g. a misspelled field, or the legacy `byline`) → refused

## What the write-back preserves

The enriched → ArchieML serialiser (`owidArticleToArchieMLStringGenerator` in
`db/model/Gdoc/archieToGdoc.ts`) emits refs in their authoring form
(`{ref}…{/ref}` inline, plus a regenerated `[.refs]` block for id-based refs —
`SpanRef.sourceForm` carries the distinction), author roles
(`Jane Doe (Editor)`), the data-insight front matter, and the post front
matter (`deprecation-notice`, `latest-feed-*`, `atom-*`, …). Underline is now
read back from Google Docs as well as written.

## Configuration

One new server setting, `GDOCS_AGENT_DRAFTS_FOLDER`: the Drive folder new
docs are created in. It must be shared with authors — a doc created outside a
shared folder lands in the service account's private Drive. Falls back to
`GDOCS_BACKPORTING_TARGET_FOLDER`.

## Limitations

- Strikethrough formatting in a gdoc is dropped on read (the enriched model
  has no strikethrough span yet). Underline round-trips; bold, italic, links,
  sub/superscript and refs do too.
- `faqs` and `details` front matter is refused rather than serialised.
- Published docs cannot be written; register a doc first
  (`PUT /gdocs/:id` with an empty body) before editing it.
- A `PUT` replaces the whole document body, so Google Docs comment anchors are
  lost; the previous revision remains in the doc's version history.
- The Google boundary (write → read back) is verified on every real write but
  not exercised in CI, which mocks `documents.get`.

## Tests

- `yarn test run db/gdocTests.test.ts db/model/Gdoc/archieToEnriched.test.ts`
  — the gate, skip-segment splitting, content comparison, ref extraction.
- `make dbtest` — `adminSiteServer/tests/gdoc-archie.test.ts` covers every
  refusal path and the read route against the fixture in
  `adminSiteServer/test-files/gdoc-archie-api-test.json`.

The writing reference (`docs/gdocs-writing-reference.md`) is what an agent
consults for block, template and guide syntax; it is served at
`/admin/api/gdocs-reference/{components,templates,guides}.json`.
