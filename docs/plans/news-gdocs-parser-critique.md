# Critique of “Direct Google Docs AST ↔ Enriched Blocks” Plan

## Architectural Alignment Risks

- **Front‑matter & ArchieML semantics**: The plan jumps from `GdocParagraph[]` to Enriched Blocks but does not spell out how all ArchieML front‑matter semantics (scalars, nested objects, arrays, multiline `:end`, list merges, implicit object starts, case‑folding) will be reproduced without the `archieml` library. Today `archieToEnriched` relies on the library plus custom pre/post transforms (e.g., `lowercaseObjectKeys`, boolean coercion, inline ref extraction). Reimplementing this by hand risks subtle divergences and duplicated logic for property parsing, quoting, and type coercion.
- **Existing raw/HTML heuristics**: Many behaviours sit in `htmlToEnriched` and `rawToEnriched` (callout upgrades, prominent-link detection, raw HTML tables, guided-chart links, warning boxes, URL hygiene, vertical‑tab supertitle splitting, FAQ / research‑and‑writing validation). The plan does not show how the direct parser will keep using those transformations or provide equivalent coverage; skipping them would change rendered output and validation surface.
- **Heading pathways**: We currently support headings created via ArchieML (`{.heading}`) with supertitle splitting (`\u000b`). The plan assumes paragraph styles map to headings, but does not address ArchieML‑defined headings or mixed cases where authors keep using markers. We risk double‑headers or lost supertitles.

## GdocParagraph Data Gaps

- **List metadata**: Google provides bullet glyphs and nesting styles through `document.lists[listId].listProperties`. Capturing only `listId`/`nestingLevel` is insufficient to rebuild ordered lists, checkbox states, or detect when a list ends (today handled via `context.isInList` + sentinels). The write‑back diff also needs `listProperties` to avoid flattening list formatting.
- **Tables & nested structural elements**: Current code only parses tables when preceded by `{.table}` and treats table cell content separately. The plan’s paragraph-centric model doesn’t explain how table cells map to paragraph indices or how to preserve start/end offsets across table boundaries (Docs adds hidden newline elements that shift indices).
- **Inline objects & footnotes**: Google Docs paragraphs can contain `inlineObjectElement`, `equation`, `pageBreak`, and footnote references. `gdocToArchie` effectively drops most of these; the plan doesn’t clarify whether to continue ignoring them or how to surface them safely (e.g., keep placeholders so offsets remain stable).
- **Suggestions metadata**: Suggestions live per text run; wrapping them as span types is proposed but not reconciled with `suggestionsViewMode` (we currently fetch `PREVIEW_WITHOUT_SUGGESTIONS` to avoid noise). Changing the mode will alter indices and may break existing revision‑based change detection.
- **Comments**: Drive comment anchors reference revisions and arbitrary `region` JSON, not just paragraph offsets. Mapping anchors to paragraph ranges without interpreting `region` will be fragile; comment ranges can cross paragraph boundaries or refer to stale revision IDs.

## Custom ArchieML Parser Concerns

- **Delimiter detection across paragraphs**: Authors often place `{.chart}` and properties on separate paragraphs, but also sometimes keep markers and content on one line or nest inline text before/after markers. A paragraph-sequential parser must handle markers that appear mid‑paragraph, multiple markers in one paragraph, or stray text between marker and block content.
- **Whitespace & escaping**: The ArchieML library performs HTML entity decoding, whitespace trimming, and tolerant parsing of stray newlines. Re‑implementing must match behaviours like collapsing repeated blank lines, handling `[]` and `[+body]` scopes, and respecting escaped braces (`\{`).
- **Error reporting parity**: `parseRawBlocksToEnrichedBlocks` attaches granular parse errors (missing required props, invalid URLs, etc.). A new parser must still route errors through `parseErrors` so admin/UI expectations and tests pass. No plan is outlined for maintaining error provenance when skipping the ArchieML intermediary.
- **Performance and determinism**: Custom parsing plus span handling may alter ordering or merge adjacent spans differently (e.g., link merging in `gdocToArchie`). We need golden tests to guarantee identical serialisation for identical inputs; otherwise diffing fingerprints will be noisy.

## Write‑Path & Diffing Risks

- **Start/end index drift**: The plan relies on `startIndex/endIndex` from the read pass to issue reverse‑ordered batch updates. These indices change when authors edit the doc between read and write; fingerprint matching needs a conflict strategy and must account for hidden structural characters (trailing newlines after tables, section breaks).
- **Multi‑paragraph blocks**: Replacing a paragraph range that maps to an ArchieML block spanning multiple paragraphs can accidentally split lists or tables if the surrounding sentinels are not regenerated precisely. The plan does not show how list/table sentinels will be reinserted or how to avoid deleting neighbouring bullets when only inner content changes.
- **Suggestions/comments during write**: Applying `deleteContentRange` on paragraphs that contain suggestions or comment anchors may delete suggestion metadata or orphan Drive comments. We need explicit rules (refuse write, strip suggestions, or convert to accepted changes) before issuing updates.
- **Feature flag & migration strategy**: Running pipelines in parallel requires deterministic comparison tooling. The plan mentions comparison but not where to insert it (CLI, admin preview, tests) or how to snapshot inputs so that flaky GDocs mutations (e.g., auto‑style normalisation) don’t cause false positives.

## Type & API Concerns

- **Span type growth**: Adding suggestion/comment span types requires updates wherever spans are serialised (markdown export, HTML rendering, RSS, search indexing). The plan only notes type additions; it omits rendering/serialisation consumers and validation.
- **Schema duplication**: Introducing `GdocParagraph` in `db/model/Gdoc` while also touching `packages/@ourworldindata/types` risks version skew if both copies diverge. Decide where the canonical type lives and how to share it (types package vs. db‑local).
- **Docs API coverage**: Start/end indices are UTF‑16 code units; combining emojis or surrogate pairs inside a paragraph will desynchronise offsets if downstream code assumes UTF‑8 lengths. The plan should call this out for fingerprinting and diffs.

## Testing Gaps

- Need fixtures covering: mixed heading sources (style vs `{.heading}`), nested lists with varying listProperties, tables with/without `{.table}`, inline refs, vertical‑tab supertitles, rich links, guided-chart links, suggestions/comments present, and documents containing emojis/surrogate pairs. No test strategy for write‑path diffs is specified.

## Clarifying Questions

1. Should we continue ingesting with `suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS"` to keep indices stable, or switch modes to capture suggestions as spans?
2. Do we intend to keep supporting ArchieML syntax authored directly in the doc (including `{ref}` and `{.heading}`), or enforce paragraph styles for headings going forward?
3. Where should the canonical `GdocParagraph` and new span types live—shared types package or db layer—to avoid duplicate definitions?
4. How strict should write‑back be when encountering comments/suggestions in the target paragraph range—abort, strip, or attempt to preserve?
5. What is the parity target for the new parser: bit‑identical Enriched Blocks (including `parseErrors`) compared to the current pipeline, or “functionally equivalent” output with tolerated differences?
