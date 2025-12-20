# Google Docs Comments in XHTML Serialization

## Problem

Embedding full comment threads inline destroys reading flow for both humans and LLMs:

```xml
<!-- BAD: Inline comments are jarring -->
<text><p>This is text with <comment id="c1" author="john@example.com" time="...">
  <content>I disagree with this word choice because...</content>
  <reply author="jane@example.com">But consider that...</reply>
  <reply author="john@example.com">Good point, but...</reply>
  <quoted>important</quoted>
</comment> information.</p></text>
```

## Solution: Anchor + Trailing Comments

Use a lightweight anchor span in the text, with the full comment thread as a sibling block element that follows "soon enough" in reading order:

```xml
<text>
  <p>This is text with <comment-ref id="c1">important</comment-ref> information.</p>
</text>
<comments>
  <comment id="c1" author="john@example.com" time="2024-01-15T10:30:00Z" resolved="false">
    <content>I disagree with this word choice because it's ambiguous.</content>
    <reply author="jane@example.com" time="2024-01-15T11:00:00Z">But consider that readers expect this terminology.</reply>
    <reply author="john@example.com" time="2024-01-15T11:30:00Z">Good point, I withdraw my objection.</reply>
  </comment>
</comments>

<heading level="2">Next Section</heading>
```

**Benefits:**

- Prose remains readable - you see "important" naturally in context
- Comment thread follows immediately after the block, maintaining locality
- LLMs can easily understand the relationship via id linking
- Multiple comments in the same paragraph each get clear references

## Google Drive API Comment Structure

Comments are fetched via Drive API (`drive.comments.list`), not Docs API.

**Comment Resource** ([API docs](https://developers.google.com/drive/api/reference/rest/v3/comments)):

```typescript
{
  id: string,                    // Unique comment ID
  anchor: string,                // JSON string - opaque format for Google Docs (kix.XXXX)
  quotedFileContent: {
    mimeType: string,
    value: string                // The actual text that was commented on
  },
  content: string,               // The comment text
  author: {
    displayName: string,
    emailAddress: string
  },
  resolved: boolean,             // Whether resolved by a reply
  createdTime: string,           // RFC 3339 timestamp
  modifiedTime: string,
  replies: Reply[]               // Chronological array of replies
}
```

**Key insight**: `quotedFileContent.value` contains the exact text that was commented on, allowing us to match comments to spans by text content even though the anchor format is opaque.

## Design Decisions

1. **Multiple comments in same block**: Each comment gets its own `<comments>` element after the block
2. **Resolved comments**: Configurable via serialization options (include/exclude)
3. **Unanchored comments**: Placed in a `<comments>` block at document end

## XHTML Elements

### Anchor Span (inline)

```xml
<comment-ref id="c1">quoted text</comment-ref>
```

Lightweight marker that wraps the commented text without disrupting flow.

### Comment Thread (block-level)

```xml
<comments>
  <comment id="c1" author="john@example.com" time="2024-01-15T10:30:00Z" resolved="false">
    <content>Comment text here</content>
    <reply author="jane@example.com" time="2024-01-15T11:00:00Z">Reply text</reply>
    <reply author="john@example.com" time="2024-01-15T11:30:00Z">Another reply</reply>
  </comment>
</comments>
```

Placed immediately after the block containing the anchor.

### Unanchored Comments (document end)

```xml
<comments unanchored="true">
  <comment id="c99" author="editor@example.com" time="2024-01-15T09:00:00Z" resolved="false">
    <content>General feedback about the document...</content>
  </comment>
</comments>
```

Document-level comments without specific text anchors.

## Example: Multiple Comments in One Paragraph

```xml
<text>
  <p>The <comment-ref id="c1">climate</comment-ref> data shows
  <comment-ref id="c2">significant</comment-ref> warming trends.</p>
</text>
<comments>
  <comment id="c1" author="editor@owid.org" time="2024-01-15T10:00:00Z" resolved="false">
    <content>Should we use "global" here?</content>
  </comment>
</comments>
<comments>
  <comment id="c2" author="reviewer@owid.org" time="2024-01-15T10:05:00Z" resolved="true">
    <content>Can we quantify "significant"?</content>
    <reply author="author@owid.org" time="2024-01-15T11:00:00Z">Added percentage in next sentence.</reply>
  </comment>
</comments>

<heading level="2">Next Section</heading>
```

## Implementation: Matching Comments to Text

During parsing (enriched blocks → XHTML):

1. Fetch comments via Drive API alongside document content
2. For each anchored comment, use `quotedFileContent.value` to find matching text
3. Wrap matched text in `<comment-ref id="...">`
4. Emit `<comments>` block after the containing block
5. Collect unanchored comments for document end

During deserialization (XHTML → enriched blocks):

1. Parse `<comment-ref>` spans and extract IDs
2. Parse `<comments>` blocks and build comment thread objects
3. Associate threads with their anchor spans via ID matching
4. Store as `SpanComment` types in the enriched block structure

## Serialization Options

```typescript
interface XhtmlSerializationOptions {
    includeComments?: boolean // default: true
    includeResolvedComments?: boolean // default: true
}
```

## New Types Required

```typescript
// New span type for comment anchors
type SpanCommentRef = {
    spanType: "span-comment-ref"
    commentId: string
    children: Span[] // The commented text
}

// Comment thread structure (for attachment/context)
interface CommentThread {
    id: string
    author: string
    time: string // RFC 3339
    resolved: boolean
    content: string
    replies: CommentReply[]
}

interface CommentReply {
    author: string
    time: string
    content: string
}
```

## Sources

- [Google Drive API - Comments Resource](https://developers.google.com/drive/api/reference/rest/v3/comments)
- [Google Drive API - Manage Comments](https://developers.google.com/drive/api/guides/manage-comments)

---

# Implementation Plan

**Note**: Comments are for internal bookkeeping and XHTML tooling only - they are NOT rendered on the website.

## Decisions

- **Storage**: New `comments` JSON column in posts_gdocs
- **Fetching**: Always fetch comments with document content
- **Matching**: Unmatched quotes → unanchored comments

---

## Phase 1: Types & Database

### 1.1 Create comment types

**File**: `packages/@ourworldindata/types/src/gdocTypes/Comments.ts`

```typescript
export interface CommentReply {
    id: string
    author: string
    content: string
    createdTime: string
    modifiedTime: string
}

export interface CommentThread {
    id: string
    author: string
    content: string
    quotedText: string
    createdTime: string
    modifiedTime: string
    resolved: boolean
    replies: CommentReply[]
}

export interface GdocComments {
    threads: CommentThread[]
    fetchedAt: string
}
```

### 1.2 Add SpanCommentRef

**File**: `packages/@ourworldindata/types/src/gdocTypes/Spans.ts`

```typescript
export type SpanCommentRef = {
    spanType: "span-comment-ref"
    commentId: string
    children: Span[]
}
// Add to Span union
```

### 1.3 Export types

**File**: `packages/@ourworldindata/types/src/index.ts`

### 1.4 Database migration

**Create**: `db/migration/{timestamp}-AddPostsGdocsCommentsColumn.ts`

- Add `comments JSON DEFAULT NULL` column to posts_gdocs

### 1.5 Update DB types

**File**: `packages/@ourworldindata/types/src/dbTypes/PostsGdocs.ts`

- Add `comments?: JsonString | null` to DbInsertPostGdoc
- Add `comments: JsonString | null` to DbRawPostGdoc
- Add parse/serialize helpers
- Update row parsing functions

### 1.6 Update schema docs

**File**: `db/docs/posts_gdocs.yml`

---

## Phase 2: Comment Fetching

### 2.1 Create fetch module

**Create**: `db/model/Gdoc/fetchGdocComments.ts`

- Use `@googleapis/drive` (already installed)
- Call `drive.comments.list()` with pagination
- Extract `quotedFileContent.value` for anchored text
- Return `GdocComments` structure

### 2.2 Integrate with GdocBase

**File**: `db/model/Gdoc/GdocBase.ts`

- Add `comments: GdocComments | null = null` property
- In `fetchAndEnrichGdoc()`: fetch comments in parallel with document
    ```typescript
    const [documentData, comments] = await Promise.all([
        docsClient.documents.get({...}),
        fetchGdocComments(this.id),
    ])
    this.comments = comments
    ```

---

## Phase 3: XHTML Serialization

### 3.1 Serialize span-comment-ref

**File**: `db/model/Gdoc/enrichedToXhtml.ts`

```typescript
.with({ spanType: "span-comment-ref" }, (s) =>
    xmlElement("comment-ref", { id: s.commentId }, spansToXhtml(s.children))
)
```

### 3.2 Add commentsToXhtml function

**File**: `db/model/Gdoc/enrichedToXhtml.ts`

```xml
<comments>
  <comment id="c1" author="..." time="..." resolved="false">
    <content>Comment text</content>
    <reply id="r1" author="..." time="...">Reply text</reply>
  </comment>
</comments>
```

### 3.3 Update document serializer signature

- `enrichedBlocksToXhtmlDocument(blocks, comments?)` → includes comments at end

---

## Phase 4: XHTML Deserialization

### 4.1 Parse comment-ref spans

**File**: `db/model/Gdoc/xhtmlToEnriched.ts`

Add to `nodeToSpan`:

```typescript
.with("comment-ref", () => ({
    spanType: "span-comment-ref" as const,
    commentId: element.attribs.id ?? "",
    children: nodesToSpans(children),
}))
```

### 4.2 Parse comments blocks

**File**: `db/model/Gdoc/xhtmlToEnriched.ts`

Add `parseCommentsElement()` to extract `CommentThread[]` from `<comments>` elements.

### 4.3 Add combined parser

```typescript
export function xhtmlToEnrichedWithComments(xhtml: string): {
    blocks: OwidEnrichedGdocBlock[]
    comments: GdocComments | null
}
```

### 4.4 Update HTML parser

**File**: `db/model/Gdoc/htmlToEnriched.ts`

Add `comment-ref` handling in `cheerioToSpan`.

---

## Phase 5: Testing

### 5.1 Unit tests

- Test `fetchGdocComments` with mock Drive API
- Test `commentsToXhtml` serialization
- Test `parseCommentsElement` deserialization
- Test `span-comment-ref` round-trip

### 5.2 Integration tests

- Add comment test cases to existing XHTML round-trip tests
- Verify comments survive full round-trip

---

## Critical Files

| File                                                       | Changes                                |
| ---------------------------------------------------------- | -------------------------------------- |
| `packages/@ourworldindata/types/src/gdocTypes/Comments.ts` | New - comment types                    |
| `packages/@ourworldindata/types/src/gdocTypes/Spans.ts`    | Add SpanCommentRef                     |
| `packages/@ourworldindata/types/src/dbTypes/PostsGdocs.ts` | Add comments field                     |
| `db/model/Gdoc/fetchGdocComments.ts`                       | New - Drive API fetching               |
| `db/model/Gdoc/GdocBase.ts`                                | Add comments property, integrate fetch |
| `db/model/Gdoc/enrichedToXhtml.ts`                         | Add span + block serialization         |
| `db/model/Gdoc/xhtmlToEnriched.ts`                         | Add span + block deserialization       |
| `db/model/Gdoc/htmlToEnriched.ts`                          | Add span parsing                       |

**Note**: `SpanElement.tsx` is NOT modified - comments are internal-only and not rendered on the website.

---

## Notes

- **Text matching**: Exact match of `quotedText` to document text. If not found or ambiguous, treat as unanchored.
- **Unanchored comments**: Collected in `<comments unanchored="true">` block at document end
- **Drive API**: Already have readonly scope configured in `OwidGoogleAuth`
- **Pagination**: Drive API returns max 100 comments per page, must handle `nextPageToken`

---

# Phase 2: Investigation - Real Document Analysis

**Status**: ✅ Complete

## Goal

Before implementing comment-to-text matching, we need to examine the actual data structures from a real Google Doc to validate our assumptions and refine the implementation plan.

## Test Document

- **Document ID**: `1ostn5k5UVGAWwo0C6A3JgnF9R63_XcU8NhiIROwU8og`
- **Title**: "Another test"
- **Credentials**: Available via `.env` file (GDOCS\_\* variables)

## Investigation Script

**Created**: `devTools/gdocs/investigateGdocComments.ts`

Run with:

```bash
npx tsx devTools/gdocs/investigateGdocComments.ts [documentId]
```

Output saved to `devTools/gdocs/gdoc-investigation/`:

- `document-ast.json` - Full document AST from Docs API
- `comments.json` - All comments from Drive API
- `plain-text.txt` - Extracted plain text from document
- `analysis.json` - Analysis of comments and text matching

## Key Findings

### 2.4.1 Anchor Field Format

- [x] **Does the `anchor` field contain any usable position information?**

**Answer**: No. The anchor format is `kix.XXXXX` (e.g., `kix.d2kfuhwhvris`), which is opaque and cannot be matched programmatically to document positions. The only `kix.*` references in the document AST are for list properties, not comments.

### 2.4.2 Quoted Text Accuracy

- [x] **Is `quotedFileContent.value` always exactly the highlighted text?**

**Answer**: Yes. In our test document with 2 comments, both had `quotedFileContent.value` that exactly matched text in the document. Match rate: 100%.

Example:

```json
{
    "quotedFileContent": {
        "mimeType": "text/html",
        "value": "talking"
    },
    "content": "Writing would be more appropriate"
}
```

### 2.4.3 Newlines and Formatting

- [x] **How are newlines/formatting handled in `quotedFileContent.value`?**

**Answer**: In our test data, no comments had newlines in the quoted text. The `mimeType` is `text/html` but the value appears to be plain text. More testing needed with multi-line highlighted text.

### 2.4.4 Edge Cases

- [x] **Are there any edge cases (empty quotes, deleted text, etc.)?**

Findings from test document:

- **Multiple matches**: "article" appeared 4 times in the document, but the comment anchor is opaque so we can't determine which occurrence was commented on
- **Reply structure**: Replies have `content`, `htmlContent`, `author`, `createdTime`, `modifiedTime`, `deleted` fields
- **No empty quotes**: All comments had quoted text in our test

### 2.4.5 Document AST Structure

The Docs API document body contains:

- `body.content[]` - Array of structural elements
- Each element has `startIndex` and `endIndex` (absolute positions)
- Paragraphs contain `elements[]` with `textRun.content` for actual text
- **No comment markers** in the document body - comments are only in Drive API

### 2.4.6 Comment Structure (Actual)

```typescript
{
  id: "AAABx9pUHoY",
  anchor: "kix.d2kfuhwhvris",  // Opaque, not usable
  quotedFileContent: {
    mimeType: "text/html",
    value: "talking"  // Exact text that was commented on
  },
  content: "Writing would be more appropriate",
  author: {
    displayName: "Daniel Bachler",
    emailAddress: undefined  // Not returned in our test
  },
  resolved: false,
  createdTime: "2025-12-20T08:17:11.971Z",
  modifiedTime: "2025-12-20T08:17:11.971Z",
  replies: []
}
```

## Implications for Phase 3

1. **Text matching is the only approach**: Since anchors are opaque, we must match `quotedFileContent.value` to document text
2. **First-match strategy is reasonable**: When text appears multiple times, anchoring to first occurrence is a sensible default
3. **Exact matching should work**: Quoted text appears to be exact, no fuzzy matching needed
4. **Email addresses may not be available**: `author.emailAddress` was undefined in our test; use `displayName` as primary identifier

---

# Phase 3: Comment Text Anchoring

**Status**: Pending (awaiting Phase 2 investigation results)

## Problem

The current implementation fetches comments from the Drive API (with `quotedText`) but **never matches them to text spans** in the document. The `SpanCommentRef` type exists but is never injected into the enriched content during document parsing.

## Background (from research)

- Google Docs API does NOT include comment markers in the document body
- Comments are fetched separately via Drive API with `quotedFileContent.value`
- The `kix.XXXXX` anchor format is opaque and cannot be matched programmatically
- **Only reliable matching**: Find `quotedText` in the document text

## User Requirements

- **First match only**: Anchor to first occurrence when text appears multiple times
- **Exact match only**: No fuzzy matching; treat as unanchored if not found

## Implementation Plan

### 3.1 Create `anchorCommentsToSpans.ts`

**New file**: `db/model/Gdoc/anchorCommentsToSpans.ts`

Core function:

```typescript
export function anchorCommentsToContent(
    content: OwidGdocContent,
    comments: GdocComments | null
): OwidGdocContent
```

**Algorithm**:

1. **Extract plain text with position mapping**:

    ```typescript
    interface TextSegment {
        text: string
        startIndex: number // Position in flattened plain text
        endIndex: number
        spanPath: number[] // Path to this span in the tree [blockIdx, spanIdx, childIdx, ...]
    }

    function extractTextWithPositions(
        blocks: OwidEnrichedGdocBlock[]
    ): TextSegment[]
    ```

2. **For each comment's `quotedText`**:
    - Find first exact match in plain text
    - Record match start/end positions

3. **Split spans at match boundaries** and wrap with `SpanCommentRef`:

    ```typescript
    function wrapTextRangeWithCommentRef(
        spans: Span[],
        startIdx: number,
        endIdx: number,
        commentId: string
    ): Span[]
    ```

4. **Return modified content** (original if no matches)

### 3.2 Update `GdocBase.ts`

**File**: `db/model/Gdoc/GdocBase.ts` (after line 960)

After `archieToEnriched()`, add:

```typescript
// Anchor comments to text spans
if (this.comments) {
    this.content = anchorCommentsToContent(this.content, this.comments)
}
```

### 3.3 Remove `#comment:` Workaround

The current implementation has a workaround that uses `#comment:id` anchor format in HTML. This should be removed once proper text matching is implemented.

**Remove from** `db/model/Gdoc/htmlToEnriched.ts`:

- Delete `commentRefRegex` (line 43)
- Remove comment matching case in `cheerioToSpan` (lines 180-186)

**Remove from** `db/model/Gdoc/xhtmlToEnriched.ts`:

- Remove `#comment:` conversion in `getSpanContent` (lines 276-280)

### 3.4 Handle Cross-Span Matches

If `quotedText` = "Hello world" spans across `<b>Hello </b><i>world</i>`:

1. Find that the match crosses span boundaries
2. Create `SpanCommentRef` that wraps both parts
3. Result: `<comment-ref id="c1"><b>Hello </b><i>world</i></comment-ref>`

This requires careful tree restructuring while preserving existing formatting.

### 3.5 Edge Cases

| Case                   | Handling                                                               |
| ---------------------- | ---------------------------------------------------------------------- |
| Text not found         | Skip, comment stays unanchored (in `comments` but no `SpanCommentRef`) |
| Duplicate text         | Anchor to first occurrence only                                        |
| Overlapping comments   | Process in order; inner comment wraps inside outer                     |
| Empty quotedText       | Skip                                                                   |
| Whitespace differences | Exact match only (may revisit after Phase 2 investigation)             |

## Files to Modify

| File                                     | Change                                            |
| ---------------------------------------- | ------------------------------------------------- |
| `db/model/Gdoc/anchorCommentsToSpans.ts` | **New** - Core matching logic                     |
| `db/model/Gdoc/GdocBase.ts`              | Call `anchorCommentsToContent()` after enrichment |
| `db/model/Gdoc/htmlToEnriched.ts`        | Remove `#comment:` workaround                     |
| `db/model/Gdoc/xhtmlToEnriched.ts`       | Remove `#comment:` conversion                     |

## Testing

1. Verify existing XHTML round-trip tests still pass
2. Add unit tests for `anchorCommentsToSpans.ts`:
    - Simple single match
    - Cross-span match
    - No match (unanchored)
    - Multiple comments
    - Overlapping comments
3. Test with real document from Phase 2

---

# Phase 4: Cross-Span Comment Anchoring

**Status**: Pending

## Problem

The Phase 3 implementation correctly handles comments within a single span or within a single nested span tree, but fails when a comment spans across sibling spans at any level.

### Example of the Bug

Given this span structure:

```xml
<bold><italic><link>Some test in link</link></italic></bold><link>some more test</link>
```

If a comment quotes "in link some more", the Phase 3 implementation produces:

```xml
<bold>
  <italic>
    <link>
      Some test
      <comment-ref id="c1">in link</comment-ref>  <!-- WRONG: nested inside link -->
    </link>
  </italic>
</bold>
<link>
  <comment-ref id="c1">some more</comment-ref>  <!-- WRONG: second comment-ref -->
  test
</link>
```

The correct output should be:

```xml
<bold><italic><link>Some test </link></italic></bold>
<comment-ref id="c1">
  <bold><italic><link>in link</link></italic></bold>
  <link>some more</link>
</comment-ref>
<link> test</link>
```

## Simplifying Assumption

**Comment refs must be non-overlapping or fully nested.** That is:

- Two comments may not partially overlap (e.g., "Hello wor" and "world today")
- One comment may be fully inside another (e.g., "Hello world" containing "world")
- If overlapping comments are detected, only the first one is anchored; subsequent overlapping comments are skipped

This matches typical Google Docs behavior where overlapping comments are rare.

## Implementation Plan

### 4.1 Create `splitSpanAtPosition` Function

Split a span tree at a given text position, returning "before" and "after" parts with preserved nesting.

```typescript
interface SplitResult {
    before: Span[] // Spans/content before the split point
    after: Span[] // Spans/content after the split point
}

function splitSpansAtPosition(spans: Span[], position: number): SplitResult
```

**Algorithm**:

1. Walk through spans accumulating text position
2. When the split position falls within a `SpanSimpleText`, split the text
3. When the split position falls within a span with children, recurse and reconstruct wrapper spans for both sides
4. Spans entirely before the position go to `before`
5. Spans entirely after the position go to `after`

**Example**: Splitting `<bold><italic>Hello world</italic></bold>` at position 6:

```
before: [<bold><italic>Hello </italic></bold>]
after:  [<bold><italic>world</italic></bold>]
```

### 4.2 Create `extractSpanRange` Function

Extract a range of text from spans as a new span array, preserving formatting.

```typescript
function extractSpanRange(
    spans: Span[],
    startPos: number,
    endPos: number
): Span[]
```

**Algorithm**:

1. Split at `startPos` to get `{before: _, after: afterStart}`
2. Split `afterStart` at `(endPos - startPos)` to get `{before: extracted, after: _}`
3. Return `extracted`

### 4.3 Rewrite `wrapSpansWithCommentRef`

Replace the current implementation with one that:

1. Finds match start and end positions in the flattened text
2. Uses `splitSpansAtPosition` to split at match boundaries
3. Wraps the extracted middle portion in a single `SpanCommentRef`
4. Reconstructs the span array: `[...before, commentRef, ...after]`

```typescript
function wrapSpansWithCommentRef(
    spans: Span[],
    startIndex: number,
    endIndex: number,
    commentId: string
): Span[] {
    const { before, after: rest } = splitSpansAtPosition(spans, startIndex)
    const matchLength = endIndex - startIndex
    const { before: matched, after } = splitSpansAtPosition(rest, matchLength)

    const commentRef: SpanCommentRef = {
        spanType: "span-comment-ref",
        commentId,
        children: matched,
    }

    return [...before, commentRef, ...after]
}
```

### 4.4 Handle Nested Comments

When processing multiple comments, sort by start position and process from last to first (reverse order) to preserve positions. Skip comments that would overlap with already-processed ones.

```typescript
function anchorCommentsToSpans(spans: Span[], matches: CommentMatch[]): Span[] {
    // Sort by start position descending (process last match first)
    const sorted = [...matches].sort((a, b) => b.startIndex - a.startIndex)

    let result = spans
    let lastStart = Infinity // Track to detect overlaps

    for (const match of sorted) {
        // Skip if this match overlaps with a previously processed one
        if (match.endIndex > lastStart) {
            continue // Overlapping, skip
        }

        result = wrapSpansWithCommentRef(
            result,
            match.startIndex,
            match.endIndex,
            match.commentId
        )
        lastStart = match.startIndex
    }

    return result
}
```

## Test Cases

### Cross-Span Cases

1. **Match spans two siblings**: `<b>Hello </b><i>world</i>` with quote "o wo"
2. **Match spans nested into sibling**: `<b><i>Hello</i></b><u>world</u>` with quote "llo wor"
3. **Match spans from deep nesting to shallow**: `<b><i><u>deep</u></i></b><span>shallow</span>` with quote "eep sha"
4. **Match spans entire nested structure plus partial sibling**

### Nested Comment Cases

5. **Outer contains inner**: "Hello world" contains "world"
6. **Multiple non-overlapping**: "Hello" and "world" in "Hello beautiful world"

### Edge Cases

7. **Match at exact span boundary**: `<b>Hello</b><i>world</i>` with quote "Hello"
8. **Match crosses multiple siblings**: `<b>A</b><i>B</i><u>C</u>` with quote "ABC"
9. **Empty spans in the middle**: Handle gracefully

## Files to Modify

| File                                     | Change                                  |
| ---------------------------------------- | --------------------------------------- |
| `db/model/Gdoc/anchorCommentsToSpans.ts` | Add split functions, rewrite wrap logic |

## Notes

- The split operation must handle `SpanNewline` correctly (doesn't contribute to text position)
- Empty spans after splitting should be filtered out
- The implementation should be pure (no mutation of input spans)
