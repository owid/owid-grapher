# Direct Google Docs AST ↔ Enriched Blocks — Revised Plan (v2)

## Objectives
- Eliminate HTML serialization while preserving inline formatting by converting Google Docs AST directly to our Span/Block model.
- Retain the raw → enriched validation boundary.
- Enable selective paragraph-range updates with accurate source tracking.
- Preserve suggestions and (read-only) comments as spans where possible.
- Achieve markdown-equivalent parity between old and new pipelines.

## Scope & Guardrails
- ArchieML support remains feature-complete (objects, arrays, `[+section]`/`[]`, `{.block}` markers, `:end` multiline, inline `{ref}`, booleans, case-insensitive keys).
- Authoring constraint: ArchieML block directives (`{.chart}`, `{.callout}`, `[+body]`, `[]`, `{}` etc.) must be the sole content of a paragraph (no trailing text/soft returns). Document this clearly in authoring guidance.
- Headings and footnotes should prefer native Google Docs constructs (heading styles, GDoc footnotes) over legacy ArchieML markers; we still ingest legacy markers but may warn.
- Keep raw/enriched distinction; enriched construction and validation continues to live in `rawToEnriched`/`htmlToEnriched` equivalents (minus HTML serialization).
- Canonical shared types (`GdocParagraph`, suggestion/comment spans) live in `packages/@ourworldindata/types`.

## Data Model Updates
- `GdocParagraph` (in types package):
  - `text`, `spans`, `index`, `startIndex`, `endIndex`, `paragraphStyle`.
  - `list` info: `listId`, `nestingLevel`, and resolved `listProperties` (glyph type, start index, checkbox state).
  - `tableContext`: row/col indexes to retain offsets inside tables.
  - `suggestedInsertionIds`, `suggestedDeletionIds`, `inlineObjectIds`, `footnoteReferenceIds`.
- Span additions:
  - `span-suggested-insertion` / `span-suggested-deletion` (captures Docs suggestion ids).
  - `span-comment` (read-only anchor to Drive comment metadata).
- Source metadata on enriched blocks: paragraph range, UTF‑16 start/end indices, markdown fingerprint.

## Read Path (New)
1) **AST → GdocParagraph[]**
   - Preserve UTF‑16 indices and table/list context.
   - Capture suggestions as spans (requires `suggestionsViewMode: "SUGGESTIONS_INLINE"`).
   - Capture comments via Drive API and map anchors to paragraph spans; fallback to warnings when anchors cannot be located.
2) **Paragraph-sequence ArchieML parser**
   - Detect block markers and section delimiters as paragraph-only tokens per guardrail.
   - Support legacy inline markers (e.g., `{.heading}` with `\u000b` supertitle), but emit warnings encouraging native styles.
   - Preserve freeform paragraphs as raw text blocks.
   - Maintain whitespace/escaping semantics equivalent to `archieml` (including escaped braces).
3) **Raw → Enriched**
   - Reuse existing validation logic; adapt inputs to bypass HTML (spans already constructed).
   - Keep all parseErrors plumbing; ensure heuristic upgrades (callouts, prominent links, guided-chart links, table opts) still run.

## Write Path (Selective)
1) Re-fetch doc (inline suggestions view) → `GdocParagraph[]`.
2) Align enriched blocks to paragraphs using markdown fingerprints and paragraph ranges (handle UTF‑16 vs UTF‑8 length differences explicitly in diff code).
3) Generate paragraph-range replacements:
   - Rebuild ArchieML text and spans directly (no HTML).
   - Recreate list/table sentinels and ensure surrounding bullets/table cells remain intact.
4) Batch updates in reverse index order; prefer preserving suggestions/comments in untouched ranges.

## Lists & Tables
- Resolve `listProperties` to maintain ordered/checkbox lists and bullet styles.
- Explicitly track table boundaries; account for hidden trailing newlines that affect indices.
- Preserve `{.table}` opt-in behaviour; document that tables without the marker remain ignored.

## Suggestions & Comments
- Suggestions captured as spans on read; on write, avoid mutating ranges containing active suggestions unless explicitly allowed (configurable policy, default “preserve/abort”).
- Comments read-only initially; warn if write touches commented ranges. Future phase may recreate anchors.

## Parity Target
- Markdown-equivalent output between old and new pipelines for the same source doc. Differences in span nesting order are acceptable if rendered markdown is identical.

## Testing & TDD Plan
1) **Golden fixtures**: Assemble a corpus of real docs plus synthetic edge cases (mixed headings, nested lists, tables with/without `{.table}`, inline refs, vertical-tab supertitles, emojis/surrogate pairs, rich links, guided-chart links, suggestions, comments).
2) **Dual-parser harness**: For each fixture, run both pipelines → compare markdown serializations and parseErrors.
3) **Round-trip tests**: parse → modify minimal block → selective write diff → reparse → compare markdown and metadata.
4) **UTF‑16/UTF‑8 tests**: Explicit cases with emojis/combining marks to verify index math in diffs.
5) Integrate into CI; start with read-path parity before enabling write-path tests.

## Migration & Feature Flag
- Ship new parser behind a flag; admin/CLI can run both and diff markdown + parseErrors.
- Log divergences; block publish on critical mismatches during rollout.

## Open Issues / Clarifications Needed
- Precise policy for writing when suggestions/comments overlap the target range (auto-accept? fail with action item?).
- Handling of inline objects/equations/footnotes: placeholders vs full support.
- Authoring guidance updates for “marker-only paragraphs” and heading/footnote best practices.
- Performance budget for dual parsing during rollout; may need caching of paragraph fingerprints.
