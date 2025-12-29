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

## Status (Branch: new-gdocs-parser)

Done:

- AST -> `GdocParagraph` with spans (bold/italic/link/etc), list/table context, indices.
- Marker-only block parsing with `{ref}` ignored for scopes.
- Paragraph blocks -> raw body using spans (text/heading/list) with legacy `{.heading}` support.
- Cross-paragraph `{ref}` handling in body (inline ref anchors; ref-only paragraphs skipped).
- Raw/enriched conversions accept span-based text values.
- `_source` metadata attachment with markdown fingerprints.
- Parity tooling: `devTools/gdocs/compareParsers.ts` and `devTools/gdocs/inspectMarkdownDiff.ts`.

Left to do:

- Tests/fixtures for `{.heading}`, `{ref}`, tables, list basics.
- Warning/telemetry for legacy `{.heading}` blocks.
- Resolve remaining parity mismatches (whitespace/link spacing, blank lines).

Write-back progress (branch: new-gdocs-parser):

- Implemented text-only write-back for frontmatter + body (paragraph-range replacements).
- Skips paragraphs with refs/guided links or inline objects/footnotes/equations.
- Uses `_source` fingerprints to detect changed blocks and update only changed ranges.
- Added generic marker-block write-back: parse current raw block, diff vs original enriched block, and rewrite only changed fields.
- Added `devTools/gdocs/writeBackTest.ts` to dry-run/apply changes against a live doc and show current vs next text for replacements.
- Added block-sequence diffing (LCS) to support insert/delete/reorder as delete+insert operations.
- Added span-aware text updates (bold/italic/link/etc) for text/heading/list replacements.
- Added ref/dod/guided span serialization (`{ref}...{/ref}`, `#dod:`, `#guide:`) and ref token reconstruction from `content.refs`.
- Added list length diffs via LCS (insert/delete/update list items with style fragments).
- Added multiline frontmatter replacement (respects `:end` command if present).
- Added suggestion overlap filtering to avoid touching text ranges with suggestions.

## Session Update

- Added default-value stripping during write-back serialization so implicit defaults are not re-emitted unless they were present in the current raw block.
- Shared raw block parsing/serialization helpers so audit tooling and write-back use identical logic.
- Enhanced `devTools/gdocs/roundTripRawGdoc.ts` with diff categorization, ignore filters, JSON output, and summary counts; added `--list-all`.
- Updated the `--all` query path in `roundTripRawGdoc.ts` to avoid MySQL sort-memory errors.
- Ran `roundTripRawGdoc.ts` for a 200-doc sample with `--ignore whitespace,ref,default,frontmatter --json` and wrote `tmp/roundtrip-summary.json`.
