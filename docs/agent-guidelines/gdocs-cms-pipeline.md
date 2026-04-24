# Google Docs CMS Pipeline

This document explains how content written in Google Docs travels through our ingestion pipeline before it is rendered on the site or written to MySQL. It focuses on implementation details, the layout of the relevant code, and quirks that have evolved as we keep the Google authoring experience in sync with our ArchieML tooling.

## Source Code Map

- `db/model/Gdoc/` — end-to-end pipeline code. Key files are:
    - `GdocBase.ts` and the subtype classes (e.g. `GdocPost.ts`, `GdocDataInsight.ts`) for fetching documents, attaching related metadata, validation, and persistence hooks.
    - `gdocToArchie.ts` for converting the Google Docs JSON AST into ArchieML-compatible text.
    - `archieToEnriched.ts`, `rawToEnriched.ts`, and `htmlToEnriched.ts` for parsing ArchieML output into our enriched JSON block model.
    - `rawToArchie.ts` and `enrichedToRaw.ts` for the inverse conversions used by tests and some editing tools.
- `db/OwidGoogleAuth.ts` — Google service account configuration.
- `db/gdocTests.test.ts` — Vitest coverage for the parsing steps.
- `db/docs/posts_gdocs.yml` — database table documentation for the final stored format.

Supporting type definitions live in `packages/@ourworldindata/types/src/gdocTypes/` and shared utilities for spans, links, etc. are in `packages/utils`.

## Authentication and Entry Points

Service account credentials from `settings/serverSettings.js` are wrapped by `OwidGoogleAuth` to produce cached, scope-limited `GoogleAuth` instances (`getGoogleReadonlyAuth` for ingestion, `getGoogleReadWriteAuth` when we need to write back to Docs).

The two most common ingestion entry points are:

1. `createGdocAndInsertIntoDb` in `GdocFactory.ts`, which fetches the latest version of a Google Doc and stores it in `posts_gdocs`.
2. `loadGdocFromGdocBase`, which hydrates a `GdocBase` (or subtype) either from Google Docs (`contentSource === GdocsContentSource.Gdocs`) or from existing database rows.

Both pathways call `GdocBase.fetchAndEnrichGdoc`, so the pipeline described below runs every time we ingest or refresh a document.

## Content Sources: Google Docs vs File-backed Content

The system supports two authoring sources:

- **Google Docs-backed rows** — the traditional path. The row points at a live Google Doc and ingestion fetches the latest Google document JSON through the Docs API.
- **File-backed rows** — the row is marked `source='file'`, and ingestion reads an ArchieML file from disk in the content repo instead of calling the Google Docs API.

The important architectural point is that these are two entry paths into the same downstream pipeline. Once the content has been fetched, both sources converge into the same enrichment, validation, attachment-loading, and persistence flow.

That means:

- component parsing rules should generally not care whether the content came from Google Docs or a file
- server-side validation should behave consistently across both sources
- front-end rendering and attachments should consume the same enriched block shapes regardless of source

The main practical difference is at fetch time:

- Google Docs-backed content starts as a Google Docs AST and needs conversion through `gdocToArchie.ts`
- file-backed content starts as ArchieML on disk and can be parsed directly into the enriched block model

When working on the pipeline, keep that split in mind: source-specific logic belongs near fetch/ingest, while block parsing and rendering should usually stay source-agnostic.

## Pipeline Overview

### 1. Fetch the Google Doc (`GdocBase.fetchAndEnrichGdoc`)

We request the document via `docs.documents.get` with `suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS"` to avoid inline suggestion noise. The method caches the returned `revisionId` for change detection and then hands the raw Google Docs `Schema$Document` object to the conversion layer.

### 2. Convert the Google AST to ArchieML (`gdocToArchie.ts`)

Google Docs returns a deeply nested AST that captures formatting, suggestions, and layout. We map it to ArchieML-oriented plain text while retaining rich inline semantics by serialising spans to HTML:

- **Paragraphs and lists** — `paragraphToString` walks each `Schema$Paragraph`, checks bullet metadata, and wraps lists in `[.list] … []` groups the way ArchieML expects. `context.isInList` ensures we emit the closing `[]` whenever we leave a list.
- **Headings** — Google’s named styles are turned into Archie `heading` blocks using `OwidRawGdocBlockToArchieMLString`.
- **Inline formatting** — `parseParagraph` builds `Span` trees (links, italics, bold, underline, superscript, subscript, dod references, guided chart links) and serialises them to HTML with `spanToHtmlString`. HTML is the temporary carrier that survives the ArchieML parser even though Archie is block-only.
- **Horizontal rules** — direct map to `{.horizontal-rule}` blocks.
- **Tables** — Google tables are only consumed when authors precede them with a `{.table}` block. That sentinel flips `context.isInTable`, letting `tableToString` emit structured Archie table rows. Without it, we skip the table entirely (protecting incidental layout tables).
- **Other quirks** — we strip excess Google formatting objects, collapse repeated newlines, and explicitly close lists when a paragraph did not do so.

The result is an ArchieML document string with HTML inline fragments.

### 3. Parse ArchieML to the “raw” block tree (`archieToEnriched.ts`)

We pre-process the Archie text before loading it:

- **Inline references** — `{ref}…{/ref}` syntax is expanded by `extractRefs`. Inline references are hashed to stable IDs, replaced with numbered `<a class="ref"><sup>…</sup></a>` tags, and their content is queued so it can be appended to `refs`.
- **Whitespace inside links** — strip pure whitespace anchor tags and move leading whitespace outside of the `<a>` tag.
- **Front matter normalisation** — `lowercaseObjectKeys` makes front matter case-insensitive (so `Title:` works), `"true"/"false"` are coerced to booleans, and any front matter value with HTML is run through `extractUrl` so the canonical href is used.

`archieml.load` gives us arrays of `OwidRawGdocBlock` instances. We convert each via `parseRawBlocksToEnrichedBlocks`, producing `OwidEnrichedGdocBlock` nodes with validated props and `parseErrors` arrays.

Finally, we merge ref definitions (`parseRefs`), normalise author lists (`parseAuthors`), and allow subtype-specific enrichment via the `additionalEnrichmentFunction` callback supplied by subclasses.

### 4. HTML and span handling (`htmlToEnriched.ts`)

Many raw blocks contain HTML fields. We parse them with Cheerio and map DOM nodes back to span nodes or block components:

- **Inline spans** — anchors, bold, italic, underline, superscript, subscript, quotes, guided-chart links, and detail-on-demand references map to dedicated span types. Unknown tags fall back to `span-fallback` so formatting is preserved even if we do not explicitly support it yet.
- **Paragraphs** — become `text` blocks merging their child spans.
- **Lists** — `<ul>` and `<ol>` items are transformed into Archie `list` / `numbered-list` blocks; we surface errors when list items contain unsupported markup.
- **Figures** — we expect an `<img>` plus optional `<figcaption>`. Captions are parsed as rich text; file names have size suffixes stripped (`-1280x840` etc.). Missing `<img>` or multiple `<figcaption>` tags add parse errors.
- **Callout heuristics** — `<div>` elements with class names containing `pcrm` (legacy “warning boxes”) are converted into `callout` blocks, promoting the first heading to the callout title.
- **Prominent links** — blockquotes that mention “related chart” and contain a Grapher link are rewritten as `prominent-link` components.
- **Tables & embeds** — unsupported tables are wrapped as raw HTML blocks (`raw-html-table__container`), while `<iframe>` Grapher embeds, `<svg>`, `<video>`, etc. become HTML blocks or chart references depending on the URL.
- **Whitespace trimming** — `withoutEmptyOrWhitespaceOnlyTextBlocks` removes empty spans so that incidental authoring whitespace does not create empty nodes.

These utilities are reused across raw parsers so that every component (aside, callout, card grids, etc.) expresses its requirements in terms of spans and enriched blocks.

### 5. Component-specific parsing and validation (`rawToEnriched.ts`)

`parseRawBlocksToEnrichedBlocks` matches block types with exhaustive `ts-pattern` clauses. Each parser enforces structure and reports actionable parse errors:

- **Charts (`.chart`, `.narrative-chart`, `.key-indicator`, `.guided-chart`)** ensure URLs resolve, optional heights are numbers, and query params look sane.
- **Lists and text** reuse `htmlToSpans`, but `parseText` additionally warns when links still point to `owid.cloud`.
- **Tables** validate templates and sizes against `tableTemplates` / `tableSizes`, then recurse into cell content.
- **Headings** split title and supertitle using the legacy vertical tab separator, then parse span trees for each part.
- **Research & writing, FAQs, topic page intros, data insights, etc.** perform bespoke validation (e.g., required authors for data insights, FAQ block constraints).

Every enriched block carries a `parseErrors` array so downstream code and the admin UI can surface issues without failing ingestion.

### 6. Subclass enrichment and metadata load

`GdocBase` provides helpers that subclasses override:

- `_enrichSubclassContent` can attach derived data (e.g., `GdocPost` generates a TOC, sticky nav, renders summary HTML into spans, and parses FAQs).
- `_getSubclassEnrichedBlocks` allows subclasses to expose extra blocks (FAQ content, references) for markdown export and search indexing.
- Validation hooks (e.g., ensuring topic pages have tags, linked charts exist) live in `_validateSubclass`.

`GdocBase` also loads linked charts, indicators, documents, authors, and image metadata after the content is parsed so we have everything needed for rendering and previews.

### 7. Persistence (`GdocFactory.ts`)

After enrichment and validation, `upsertGdoc` serialises the enriched content to JSON, records the revision in `posts_gdocs`, and updates helper tables (`posts_gdocs_components`, `posts_gdocs_links`, `posts_gdocs_x_images`, etc.). Markdown fallback text is generated via `enrichedBlocksToMarkdown`.

## Key Quirks and Edge Cases

- **Inline styling retention** — all Google inline styles are mapped to HTML tags before running through ArchieML so that we keep precise spans (bold, italic, underline, superscript, subscript, quotes, detail-on-demand links, guided chart links). Subscripts and superscripts specifically map to `<sub>` / `<sup>` and later to `span-subscript` / `span-superscript` nodes (see `spanToHtmlString` and `htmlToEnriched.ts`).
- **List delimiters** — Google lists auto-close; to keep Archie response deterministic we track `context.isInList` and emit `[]` when the next paragraph is not a list item.
- **Tables require opt-in** — Only tables preceded by `{.table}` are parsed into structured blocks. Otherwise we assume they are layout tables and drop them to avoid surprising structure in the output.
- **Heading supertitles** — We still rely on the vertical tab (`\u000b`) separator to distinguish supertitles, so authors must avoid using that character inside nested spans.
- **Footnotes** — Inline `{ref}` blocks hash their content to a stable ID, letting multiple mentions reuse the same footnote number. Missing definitions or unused IDs surface explicit errors in the admin.
- **Legacy callouts & prominent links** — Because authors historically used ad-hoc markup, we heuristically upgrade known patterns (e.g., `.pcrm` divs, “related chart” blockquotes).
- **URL hygiene** — `parseText` warns on `owid.cloud` URLs so we catch staging leftovers early, and front matter links always resolve to their `<a href>` targets.
- **Whitespace handling** — `GdocBase.validate` guards against vertical tabs, carriage returns, and tabs sneaking into serialized JSON to prevent rendering issues.

## Testing and Debugging

- Run `yarn test run db/gdocTests.test.ts --reporter dot` to execute ingestion-focused unit tests.
- For ad-hoc experiments, `devTools/markdownTest/markdown.ts` can parse a database row into enriched blocks.
- The database schema docs in `db/docs/posts_gdocs.yml` summarise the stored format and companion tables (`posts_gdocs_components`, `posts_gdocs_links`, etc.).

## Adding or Extending Components

This section covers the usual workflow for introducing or extending an ArchieML/Gdoc component.

Start by classifying the request:

1. **Docs-only** — the component already exists and only its JSDoc or examples need updating.
2. **Existing component extension** — add props or variants to a block that already exists.
3. **New component** — add a new block that needs parser and render support.
4. **Attachment-backed component** — the component also needs server-loaded data such as charts, linked docs, images, tags, or other metadata.
5. **Actually a new gdoc type** — the work belongs in the subclass/factory/type system rather than a generic block component.

Before editing, inspect one or two structurally similar components in:

- `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/`
- `db/model/Gdoc/rawToEnriched.ts`
- `site/gdocs/components/`

Treat nearby components as the best template for naming, typing, validation style, and rendering patterns.

### Typical integration path

1. **Define or extend the component type**

    Add or update the type under `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/`.

    That file should usually contain:
    - the raw block shape
    - the enriched block shape
    - concise JSDoc describing when to use the component
    - realistic `@example` blocks with valid ArchieML

    The generated component registry is derived from these JSDoc comments, so examples should parse cleanly and reflect real usage.

    If the component is new, make sure it is exported through the shared gdoc type surface, including `packages/@ourworldindata/types/src/gdocTypes/ArchieMlComponents.ts` and any relevant barrel exports.

2. **Parse raw Archie into enriched blocks**

    Update `db/model/Gdoc/rawToEnriched.ts` so the raw block is converted into the enriched block and emits targeted parse errors for malformed input.

    Prefer:
    - strict validation
    - actionable parse errors
    - reuse of existing helpers for spans, URLs, links, captions, tables, and nested blocks

    Avoid silently accepting malformed author input when a clear parse error would make the problem easier to fix.

3. **Update HTML/span parsing only if needed**

    Most component changes do not require edits in `db/model/Gdoc/htmlToEnriched.ts`, but some do.

    Touch it when the component relies on special inline HTML handling, block HTML conversion, figure parsing, or other Google Docs constructs that are not already understood by the pipeline.

4. **Render the component on the site**

    Add or update the front-end rendering in `site/gdocs/components/` and any page-level wiring that consumes the enriched block.

    Match existing surrounding patterns:
    - keep rendering logic in the gdocs component layer
    - preserve established visual and layout conventions unless the task explicitly changes them
    - inspect adjacent components before introducing new abstractions

5. **Load attachments if the component needs extra data**

    If the component needs charts, linked documents, image metadata, authors, tags, or other server-provided context:
    - extend the relevant gdoc types in `packages/@ourworldindata/types`
    - load the data in `GdocBase` or a subclass attachment hook
    - ensure the data reaches the page payload
    - consume it through the existing attachments context on the front end

    Prefer batched lookups over per-item queries when introducing new attachment loaders.

6. **Document the component through JSDoc and generated artifacts**

    After updating JSDoc, regenerate the component reference:

    ```bash
    yarn tsx --tsconfig tsconfig.tsx.json devTools/gdocs/generate-components-reference.ts
    ```

    Do not hand-edit:
    - `docs/components-reference.generated.md`
    - `docs/components.registry.generated.json`

7. **Test the changed area**

    Add or update tests close to the behavior you changed. In most cases this means gdoc ingestion tests, parser tests, or focused front-end tests for the rendered block.

    Useful checks include:
    - Archie examples parse cleanly
    - malformed inputs produce the intended parse errors
    - attachments are loaded when required
    - the component renders with the enriched shape you expect

By following these steps we keep the ingestion pipeline deterministic while preserving the rich authoring experience our authors expect inside Google Docs.
