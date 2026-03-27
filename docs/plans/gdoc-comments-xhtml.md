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
