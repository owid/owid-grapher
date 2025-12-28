# Direct Google Docs AST -> Enriched Blocks (v3)

This version updates the v2 plan based on the audit results:
- `{ref}` is a legacy inline marker, not an ArchieML scope directive.
- `{.heading}` blocks are still common and must be supported.
- Tables remain opt-in via `{.table}` markers.
- Nested/ordered list nuance can be ignored for v1.

## Overview (Updated)

### Step 0: Constraints and guardrails
- Scope markers are **marker-only paragraphs**: `{.chart}`, `{}`, `[+body]`, `[]`, etc.
- `{ref}` is **ignored** by scope detection; treat it as inline text.
- Legacy `{.heading}` blocks are supported (warn for migration); heading styles are preferred.
- Tables are parsed **only** when wrapped in `{.table}` / `{}` markers.
- Ignore ordered/nested list semantics in v1.

### Step 1: AST -> GdocParagraph
Convert Google Docs AST into a paragraph-level model that preserves:
- `text` (plain content), `spans` (formatting), `startIndex/endIndex`
- paragraph style (heading level), list metadata, table context
- inline objects and other unsupported elements as placeholders or warnings

### Step 2: Paragraph-sequence ArchieML parsing
Parse the paragraph array into block ranges using marker-only paragraphs:
- Open/close scopes using `{}` / `[]` tokens
- Allow legacy `{.heading}` blocks
- Treat `{ref}` as inline content only
- Freeform paragraphs become text blocks

### Step 3: Raw -> Enriched
Reuse existing validation and heuristics (callouts, guided charts, etc.).
Handle `{ref}` extraction here (convert to ref spans or ignore for now).

### Step 4: Source metadata
Attach paragraph range metadata to enriched blocks:
- `startIndex/endIndex` in UTF-16
- paragraph index range
- markdown fingerprint for alignment

### Step 5: Write-back (later phase)
Align by fingerprint + paragraph ranges and replace only changed ranges.
Abort or warn if suggestions/comments overlap changed ranges.

## Concrete Module Layout

### Types (shared)
- `packages/@ourworldindata/types/src/gdocTypes/GdocParagraph.ts`
  - `GdocParagraph` interface (text, spans, indices, style, list, table context)
- `packages/@ourworldindata/types/src/gdocTypes/Spans.ts`
  - Add/update `SpanRef` or similar for `{ref}` extraction (if not already present)

### Read Path (new)
- `db/model/Gdoc/gdocAstToParagraphs.ts`
  - `documentToParagraphs(doc): GdocParagraph[]`
  - extracts paragraph text/spans + indices, list + table context
- `db/model/Gdoc/archieParagraphParser.ts`
  - `parseParagraphBlocks(paragraphs): ParsedBlock[]`
  - marker-only parser that ignores `{ref}` in scope detection
- `db/model/Gdoc/gdocAstToEnriched.ts`
  - orchestrates: AST -> paragraphs -> parsed blocks -> raw -> enriched
- `db/model/Gdoc/gdocSourceMetadata.ts`
  - helpers for `_source` metadata and fingerprints
- `db/model/Gdoc/refSyntax.ts`
  - `{ref}` extraction from text spans (used in raw -> enriched step)

### Write Path (later)
- `db/model/Gdoc/gdocDiff.ts`
  - align blocks to current paragraphs by fingerprint + range
- `db/model/Gdoc/enrichedToParagraphs.ts`
  - block -> paragraph serialization (no HTML)
- `db/model/Gdoc/archieToGdoc.ts`
  - support selective updates (delete + insert for paragraph ranges)

### Testing / Tooling
- `devTools/gdocs/compareParsers.ts`
  - Run old vs new pipelines and compare markdown + parseErrors
- `db/gdocTests.test.ts`
  - Add fixtures covering `{.heading}`, `{ref}`, table markers, list basics

## First Implementation Slice
1. Implement `GdocParagraph` + `gdocAstToParagraphs.ts`.
2. Add `archieParagraphParser.ts` with marker-only parsing and `{ref}` ignored for scopes.
3. Route to existing raw/enriched logic; add a parity harness for a small doc set.
