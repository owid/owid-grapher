# Direct Google Docs AST to Enriched Blocks: Feasibility Study & Transition Plan

## Executive Summary

**Goal**: Replace the current `Google Docs AST → ArchieML text → Enriched Blocks` pipeline with a direct `Google Docs AST ↔ Enriched Blocks` transformation, enabling paragraph-level round-tripping for selective updates.

**Verdict**: Feasible with structural adaptations. The main work involves:
1. Creating an intermediate `GdocParagraph` structure that preserves source positions
2. Implementing custom ArchieML-aware parsing to group paragraphs into blocks
3. Adding metadata to track which source paragraphs map to which enriched blocks
4. Adding new span types for suggestions (and later, comments)

---

## Current Pipeline

### Read Path (Today)
```
Google Docs JSON (docs_v1.Schema$Document)
    ↓ gdocToArchie.ts - converts paragraphs to ArchieML text string, spans to HTML
ArchieML Text (with embedded HTML)
    ↓ archieToEnriched.ts - parses ArchieML library, extracts {ref} syntax
OwidRawGdocBlock[]
    ↓ rawToEnriched.ts + htmlToEnriched.ts - validates, parses HTML to spans
OwidEnrichedGdocBlock[] (with Span trees)
```

### Write Path (Today)
```
OwidEnrichedGdocBlock[]
    ↓ enrichedToRaw.ts → rawToArchie.ts → archieToGdoc.ts
Google Docs API batchUpdate (DELETE ALL + INSERT ALL)
```

**Key limitation**: Writing deletes the entire document and re-inserts everything.

---

## Critical Insight: Paragraphs ≠ Blocks

Google Docs paragraphs do **not** map 1:1 to `EnrichedBlock` objects. Authors write ArchieML syntax across multiple paragraphs:

```
{.chart}                          ← Paragraph 1
url: https://example.com/chart    ← Paragraph 2
{}                                ← Paragraph 3

This is body text.                ← Paragraph 4

My Section                        ← Paragraph 5 (paragraphStyle: HEADING_2)

More body text here.              ← Paragraph 6
```

This becomes 4 `EnrichedBlock` objects:
1. `EnrichedBlockChart` (from paragraphs 1-3, via ArchieML syntax)
2. `EnrichedBlockText` (from paragraph 4)
3. `EnrichedBlockHeading` (from paragraph 5, via native Google Docs heading style)
4. `EnrichedBlockText` (from paragraph 6)

**Two mechanisms for block creation:**
- **ArchieML syntax**: Most components use `{.blockType}...{}` markers spanning multiple paragraphs
- **Native paragraph styles**: Headings use Google Docs' built-in HEADING_1, HEADING_2, etc. styles (1 paragraph = 1 block)

**Implication**: We need an intermediate structure and custom ArchieML parsing that also respects native paragraph styles.

---

## Google Docs API Constraints

### Positioning
- **No stable paragraph IDs**: Elements identified by `startIndex`/`endIndex` (UTF-16 offsets)
- **Indices shift on edits**: Insertions increment all higher indices
- **Best practice**: Process write operations in reverse index order

### Suggestions (Docs API)
- Built into document structure via `suggestedInsertionIds` and `suggestedDeletionIds` on text runs
- Three view modes: `SUGGESTIONS_INLINE`, `PREVIEW_WITHOUT_SUGGESTIONS`, `PREVIEW_WITH_SUGGESTIONS`
- Reading is well-supported; programmatic creation is limited

### Comments (Drive API - separate!)
- Fetched via Drive API (`drive.comments.list`), not Docs API
- Anchors are JSON strings with `revisionID` and `region`
- **Anchors are immutable** - position cannot be guaranteed across revisions
- Support replies and resolution status

---

## Span Type Compatibility

Current spans map directly to Google Docs:

| Span Type | Google Docs Equivalent |
|-----------|----------------------|
| `span-simple-text` | `TextRun.content` |
| `span-bold` | `TextStyle.bold: true` |
| `span-italic` | `TextStyle.italic: true` |
| `span-link` | `TextStyle.link.url` |
| `span-superscript` | `TextStyle.baselineOffset: "SUPERSCRIPT"` |
| `span-subscript` | `TextStyle.baselineOffset: "SUBSCRIPT"` |
| `span-underline` | `TextStyle.underline: true` |

**Good news**: `gdocToArchie.ts` already builds `Span` trees directly from Google Docs AST (lines 23-49, 277-339). This logic can be reused.

---

## Proposed Architecture

### New Data Flow

```
READ:
Google Docs AST (docs_v1.Schema$Document)
    ↓ Step 1: Convert each paragraph to GdocParagraph (preserving spans + indices)
GdocParagraph[] (intermediate structure)
    ↓ Step 2: Custom ArchieML parser groups paragraphs by block boundaries
    ↓ Step 3: Convert grouped paragraphs to EnrichedBlocks
OwidEnrichedGdocBlock[] with _source metadata (tracking source paragraph ranges)

WRITE (selective):
Modified OwidEnrichedGdocBlock[]
    ↓ Re-fetch current Google Docs AST → GdocParagraph[]
    ↓ Align blocks to current paragraphs by fingerprint matching
    ↓ For changed blocks: regenerate ArchieML, compute paragraph-range replacement
    ↓ Batch update (delete range + insert) for changed paragraph ranges only
```

### New Intermediate Structure: GdocParagraph

```typescript
// Represents a single Google Docs paragraph with preserved source info
interface GdocParagraph {
    // Content
    text: string                    // Plain text (for ArchieML parsing)
    spans: Span[]                   // Rich formatting (for text blocks)

    // Source tracking (for write-back)
    index: number                   // Position in document.body.content[]
    startIndex: number              // UTF-16 offset start
    endIndex: number                // UTF-16 offset end

    // Paragraph metadata
    paragraphStyle?: string         // "HEADING_1", "HEADING_2", etc.
    bullet?: {                      // If this is a list item
        nestingLevel: number
        listId: string
    }

    // For suggestions/comments
    suggestedInsertionIds?: string[]
    suggestedDeletionIds?: string[]
}
```

### Custom ArchieML Parsing

Instead of using the ArchieML library on a concatenated string, we parse the paragraph sequence directly:

```typescript
interface ArchieMLParseResult {
    blocks: ParsedBlock[]
}

interface ParsedBlock {
    type: "freeform" | "object" | "array"

    // For objects like {.chart}...{}
    blockType?: string              // "chart", "heading", etc.
    properties?: Record<string, string | GdocParagraph[]>

    // For freeform text (paragraphs between blocks)
    paragraphs?: GdocParagraph[]

    // Source tracking
    sourceParagraphs: GdocParagraph[]   // All paragraphs that make up this block
    startIndex: number                   // First paragraph's startIndex
    endIndex: number                     // Last paragraph's endIndex
}
```

**Parsing logic:**
1. Check paragraph style first - if HEADING_1/HEADING_2/etc., emit `EnrichedBlockHeading` immediately (1 paragraph = 1 block)
2. Detect ArchieML block start markers: `{.chart}`, `{.image}`, `[.list]`, etc.
3. Detect block end markers: `{}`, `[]`
4. Group paragraphs between markers into blocks
5. Track which source paragraphs contribute to each block
6. Freeform paragraphs (no markers, no heading style) become `EnrichedBlockText`

### Source Metadata on Enriched Blocks

```typescript
// Added to EnrichedBlockWithParseErrors
interface SourceMetadata {
    _source?: {
        // Which paragraphs this block came from
        paragraphRange: {
            startParagraphIndex: number
            endParagraphIndex: number
        }
        // Character offsets for the entire block
        startIndex: number
        endIndex: number
        // For quick change detection
        contentFingerprint: string
    }
}
```

### New Span Types for Suggestions

```typescript
type SpanSuggestedInsertion = {
    spanType: "span-suggested-insertion"
    suggestionId: string
    children: Span[]
}

type SpanSuggestedDeletion = {
    spanType: "span-suggested-deletion"
    suggestionId: string
    children: Span[]
}
```

### New Span Type for Comments (Phase 2)

```typescript
type SpanComment = {
    spanType: "span-comment"
    commentId: string
    content: string
    author?: string
    resolved: boolean
    replies?: Array<{ author: string; content: string }>
    children: Span[]  // The commented text
}
```

---

## Implementation Phases

### Phase 1: Intermediate Structure + Direct Parser (Read Path)

**1a. Create GdocParagraph conversion**
- Convert `docs_v1.Schema$Paragraph` → `GdocParagraph`
- Preserve spans, indices, paragraph styles
- Handle suggestions by wrapping in new span types

**1b. Implement custom ArchieML parser**
- Parse paragraph sequence for block markers
- Group paragraphs into logical blocks
- Handle nested structures (arrays, objects)
- Track source paragraph ranges

**1c. Convert to EnrichedBlocks**
- Map parsed blocks to `OwidEnrichedGdocBlock` types
- Apply semantic transformations (`{ref}` syntax, URL patterns, etc.)
- Attach `_source` metadata

**Files**:
- `db/model/Gdoc/GdocParagraph.ts` (NEW) - intermediate structure + conversion
- `db/model/Gdoc/archieMLParser.ts` (NEW) - custom ArchieML parsing
- `db/model/Gdoc/gdocAstToEnriched.ts` (NEW) - orchestrates the pipeline
- `packages/@ourworldindata/types/src/gdocTypes/Spans.ts` (add suggestion spans)

### Phase 2: Selective Write-Back

**2a. Paragraph alignment**
- Re-fetch document, convert to `GdocParagraph[]`
- Match enriched blocks to current paragraphs by fingerprint
- Detect insertions, deletions, modifications

**2b. Block-to-paragraphs conversion**
- Convert modified `EnrichedBlock` back to ArchieML text
- Split into paragraph-sized chunks
- Generate Docs API requests for the paragraph range

**2c. Batch update generation**
- Compute `DeleteContentRange` + `InsertText` operations
- Process in reverse index order
- Handle conflicts (document edited since parse)

**Files**:
- `db/model/Gdoc/gdocDiff.ts` (NEW) - paragraph alignment + diff
- `db/model/Gdoc/enrichedToGdocAst.ts` (NEW) - block → paragraph conversion
- `db/model/Gdoc/archieToGdoc.ts` (modify) - support selective updates

### Phase 3: Comments (Read-Only Initially)

1. Fetch comments via Drive API alongside document
2. Map comment anchors to paragraph ranges
3. Wrap commented text in `SpanComment`
4. Warn when writing to paragraphs with comments

**Files**:
- `db/model/Gdoc/gdocAstToEnriched.ts` (extend)
- `packages/@ourworldindata/types/src/gdocTypes/Spans.ts` (add comment span)

### Phase 4: Full Comment Support (Future)

- Create comments via Drive API when writing
- Update/recreate anchors when commented text changes
- Handle reply threads

---

## Migration Strategy

### Parallel Operation
1. Keep existing `gdocToArchie.ts` pipeline working
2. Build new direct parser alongside
3. Add feature flag to switch between pipelines
4. Compare outputs during testing to ensure parity

### Testing Strategy
- Parse same documents with both pipelines
- Compare resulting `EnrichedBlock[]` structures
- Verify all block types, spans, and metadata match
- Round-trip tests: parse → modify → write → parse again

### Backward Compatibility
- Existing `OwidEnrichedGdocBlock` types unchanged (new `_source` field is optional)
- New suggestion/comment spans gracefully degrade (render children only if not supported)

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Custom ArchieML parser doesn't match library behavior | Comprehensive test suite comparing both parsers |
| Semantic transformations missed in new parser | Test suite comparing old vs new parser output |
| Index drift during concurrent editing | Re-fetch before write, use content matching, fail gracefully |
| Multi-paragraph blocks harder to diff | Use paragraph-range fingerprints, not individual paragraphs |
| Comment anchors become invalid | Warn user, offer to remove/recreate comments |

---

## Design Decisions

1. **Primary use case**: Automated corrections initially, expanding to plugin-based editing
2. **Formatting preservation**: Comments/suggestions valuable; font colors/sizes not needed
3. **Granularity**: Paragraph-level diffs are acceptable (actually paragraph-range for multi-paragraph blocks)
4. **Conflict handling**: Customizable per-operation (refuse, merge, or overwrite)
5. **Comments approach**: Preserve on read, warn on write initially; full support later
6. **Pipeline replacement**: New parser will replace ArchieML pipeline (with both running in parallel during development)
7. **OWID syntax**: `{ref}` is the only special syntax pattern that needs handling
8. **Intermediate structure**: `GdocParagraph` bridges Google Docs AST and ArchieML parsing

---

## Sources

- [Google Docs API Structure](https://developers.google.com/workspace/docs/api/concepts/structure)
- [Google Docs API Requests](https://developers.google.com/docs/api/reference/rest/v1/documents/request)
- [Working with Suggestions](https://developers.google.com/workspace/docs/api/how-tos/suggestions)
- [Manage Comments and Replies](https://developers.google.com/drive/api/guides/manage-comments)
- [Insert, Delete, and Move Text](https://developers.google.com/workspace/docs/api/how-tos/move-text)
