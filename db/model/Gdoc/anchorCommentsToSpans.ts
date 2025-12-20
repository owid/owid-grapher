import {
    Span,
    SpanCommentRef,
    SpanSimpleText,
    GdocComments,
    CommentThread,
    OwidGdocContent,
    OwidEnrichedGdocBlock,
} from "@ourworldindata/utils"
import { match, P } from "ts-pattern"

/**
 * Result of matching a comment to text.
 */
interface CommentMatch {
    commentId: string
    startIndex: number
    endIndex: number
}

/**
 * Result of splitting spans at a position.
 */
interface SplitResult {
    before: Span[]
    after: Span[]
}

/**
 * Get plain text from a single span.
 */
function getSpanPlainText(span: Span): string {
    return match(span)
        .with({ spanType: "span-simple-text" }, (s) => s.text)
        .with({ spanType: "span-newline" }, () => "")
        .with({ children: P.any }, (s) =>
            s.children.map(getSpanPlainText).join("")
        )
        .exhaustive()
}

/**
 * Get the plain text representation of spans.
 */
function spansToPlainText(spans: Span[]): string {
    return spans.map(getSpanPlainText).join("")
}

/**
 * Deep clone a span.
 */
function cloneSpan(span: Span): Span {
    return JSON.parse(JSON.stringify(span))
}

/**
 * Check if a span array is empty or contains only empty content.
 */
function isEmptySpans(spans: Span[]): boolean {
    return spansToPlainText(spans) === ""
}

/**
 * Filter out spans that have no text content.
 * This removes empty text spans and wrapper spans with no content.
 */
function filterEmptySpans(spans: Span[]): Span[] {
    return spans.filter((span) => {
        if (span.spanType === "span-simple-text") {
            return span.text.length > 0
        }
        if (span.spanType === "span-newline") {
            return true // Keep newlines
        }
        if ("children" in span) {
            // For wrapper spans, filter children and check if any remain
            const filteredChildren = filterEmptySpans(span.children)
            if (filteredChildren.length === 0) {
                return false
            }
            // Update children in place (we already cloned)
            span.children = filteredChildren
            return true
        }
        return true
    })
}

/**
 * Split a span array at a given text position.
 * Returns the spans before and after the split point, preserving nesting.
 *
 * For example, splitting `<b><i>Hello world</i></b>` at position 6 yields:
 * - before: `[<b><i>Hello </i></b>]`
 * - after: `[<b><i>world</i></b>]`
 */
function splitSpansAtPosition(spans: Span[], position: number): SplitResult {
    // Edge cases
    if (position <= 0) {
        return { before: [], after: spans.map(cloneSpan) }
    }

    const totalLength = spansToPlainText(spans).length
    if (position >= totalLength) {
        return { before: spans.map(cloneSpan), after: [] }
    }

    const before: Span[] = []
    const after: Span[] = []
    let currentPos = 0
    let splitComplete = false

    for (const span of spans) {
        if (splitComplete) {
            after.push(cloneSpan(span))
            continue
        }

        const spanText = getSpanPlainText(span)
        const spanLength = spanText.length
        const spanEnd = currentPos + spanLength

        if (spanEnd <= position) {
            // Entire span is before the split point
            before.push(cloneSpan(span))
        } else if (currentPos >= position) {
            // Entire span is after the split point
            after.push(cloneSpan(span))
            splitComplete = true
        } else {
            // Split point is within this span
            const localSplitPos = position - currentPos

            if (span.spanType === "span-simple-text") {
                // Split the text
                const beforeText = span.text.substring(0, localSplitPos)
                const afterText = span.text.substring(localSplitPos)

                if (beforeText) {
                    before.push({
                        spanType: "span-simple-text",
                        text: beforeText,
                    })
                }
                if (afterText) {
                    after.push({
                        spanType: "span-simple-text",
                        text: afterText,
                    })
                }
            } else if (span.spanType === "span-newline") {
                // Newlines have no text length, just add to before
                before.push(cloneSpan(span))
            } else if ("children" in span) {
                // Recursively split children
                const childSplit = splitSpansAtPosition(
                    span.children,
                    localSplitPos
                )

                // Create wrapper spans for before and after parts
                if (childSplit.before.length > 0) {
                    const beforeWrapper = {
                        ...cloneSpan(span),
                        children: childSplit.before,
                    } as Span
                    before.push(beforeWrapper)
                }
                if (childSplit.after.length > 0) {
                    const afterWrapper = {
                        ...cloneSpan(span),
                        children: childSplit.after,
                    } as Span
                    after.push(afterWrapper)
                }
            }

            splitComplete = true
        }

        currentPos = spanEnd
    }

    return { before, after }
}

/**
 * Wrap a portion of the spans array (from startIndex to endIndex in plain text)
 * with a SpanCommentRef.
 *
 * This properly handles cross-span matches by:
 * 1. Splitting at the start position
 * 2. Splitting the remainder at the match length
 * 3. Wrapping the middle portion in a SpanCommentRef
 */
function wrapSpansWithCommentRef(
    spans: Span[],
    startIndex: number,
    endIndex: number,
    commentId: string
): Span[] {
    const plainText = spansToPlainText(spans)

    // If the match is outside our text, return spans unchanged
    if (startIndex >= plainText.length || endIndex <= 0) {
        return spans.map(cloneSpan)
    }

    // Clamp indices to valid range
    const clampedStart = Math.max(0, startIndex)
    const clampedEnd = Math.min(plainText.length, endIndex)
    const matchLength = clampedEnd - clampedStart

    // Split at the start of the match
    const { before, after: rest } = splitSpansAtPosition(spans, clampedStart)

    // Split the remainder at the end of the match
    const { before: matched, after } = splitSpansAtPosition(rest, matchLength)

    // Filter out empty spans
    const filteredBefore = filterEmptySpans(before)
    const filteredMatched = filterEmptySpans(matched)
    const filteredAfter = filterEmptySpans(after)

    // If nothing matched, return original spans
    if (filteredMatched.length === 0) {
        return spans.map(cloneSpan)
    }

    // Create the comment ref
    const commentRef: SpanCommentRef = {
        spanType: "span-comment-ref",
        commentId,
        children: filteredMatched,
    }

    // Combine results
    return [...filteredBefore, commentRef, ...filteredAfter]
}

/**
 * Find the first occurrence of quotedText in the document's plain text.
 * Returns the match position or null if not found.
 */
function findFirstMatch(
    plainText: string,
    quotedText: string
): { start: number; end: number } | null {
    if (!quotedText) return null
    const index = plainText.indexOf(quotedText)
    if (index === -1) return null
    return { start: index, end: index + quotedText.length }
}

/**
 * Find all matches for comments in the given spans and return their positions.
 */
function findCommentMatches(
    spans: Span[],
    threads: CommentThread[]
): CommentMatch[] {
    const plainText = spansToPlainText(spans)
    const matches: CommentMatch[] = []

    for (const thread of threads) {
        if (!thread.quotedText) continue
        const match = findFirstMatch(plainText, thread.quotedText)
        if (match) {
            matches.push({
                commentId: thread.id,
                startIndex: match.start,
                endIndex: match.end,
            })
        }
    }

    return matches
}

/**
 * Check if two matches overlap (but neither fully contains the other).
 */
function matchesOverlap(a: CommentMatch, b: CommentMatch): boolean {
    // Check if they overlap at all
    const overlaps = a.startIndex < b.endIndex && b.startIndex < a.endIndex

    if (!overlaps) return false

    // Check if one fully contains the other (nested, not overlapping)
    const aContainsB = a.startIndex <= b.startIndex && a.endIndex >= b.endIndex
    const bContainsA = b.startIndex <= a.startIndex && b.endIndex >= a.endIndex

    // It's a problematic overlap if they overlap but neither contains the other
    return !aContainsB && !bContainsA
}

/**
 * Filter out overlapping comments, keeping only the first one.
 * Nested comments (one fully inside another) are allowed.
 */
function filterOverlappingMatches(matches: CommentMatch[]): CommentMatch[] {
    const result: CommentMatch[] = []

    for (const match of matches) {
        // Check if this match overlaps with any already-accepted match
        const hasOverlap = result.some((accepted) =>
            matchesOverlap(accepted, match)
        )
        if (!hasOverlap) {
            result.push(match)
        }
    }

    return result
}

/**
 * Process a single block to anchor comments to spans.
 */
function anchorCommentsToBlock(
    block: OwidEnrichedGdocBlock,
    matches: CommentMatch[]
): OwidEnrichedGdocBlock {
    if (matches.length === 0) return block

    // Filter out overlapping matches
    const filteredMatches = filterOverlappingMatches(matches)

    // Sort by start position descending (process last match first to preserve positions)
    const sortedMatches = [...filteredMatches].sort(
        (a, b) => b.startIndex - a.startIndex
    )

    return match(block)
        .with({ type: "text" }, (textBlock) => {
            let currentValue = textBlock.value
            for (const m of sortedMatches) {
                currentValue = wrapSpansWithCommentRef(
                    currentValue,
                    m.startIndex,
                    m.endIndex,
                    m.commentId
                )
            }
            return { ...textBlock, value: currentValue }
        })
        .with({ type: "heading" }, (headingBlock) => {
            let currentText = headingBlock.text
            for (const m of sortedMatches) {
                currentText = wrapSpansWithCommentRef(
                    currentText,
                    m.startIndex,
                    m.endIndex,
                    m.commentId
                )
            }
            return { ...headingBlock, text: currentText }
        })
        .otherwise(() => block)
}

/**
 * Anchor comments to spans in the content body.
 * This modifies spans to include SpanCommentRef wrappers where comments
 * are anchored to text.
 */
export function anchorCommentsToContent(
    content: OwidGdocContent,
    comments: GdocComments | null
): OwidGdocContent {
    if (!comments || !comments.threads || comments.threads.length === 0) {
        return content
    }

    // We only anchor to body blocks for now
    if (!("body" in content) || !content.body) {
        return content
    }

    // Track which comments have been matched (first occurrence only)
    const unmatchedThreads = [...comments.threads]
    const newBody: OwidEnrichedGdocBlock[] = []

    for (const block of content.body) {
        // Extract spans from the block
        const blockSpans = getBlockSpans(block)

        if (blockSpans.length === 0) {
            // No spans in this block, add it unchanged
            newBody.push(block)
            continue
        }

        // Find matches in this block
        const matches = findCommentMatches(blockSpans, unmatchedThreads)

        if (matches.length === 0) {
            // No matches in this block
            newBody.push(block)
            continue
        }

        // Remove matched threads from the unmatched list
        for (const m of matches) {
            const idx = unmatchedThreads.findIndex(
                (t) => t.id === m.commentId
            )
            if (idx !== -1) {
                unmatchedThreads.splice(idx, 1)
            }
        }

        // Anchor the comments to the block
        const anchoredBlock = anchorCommentsToBlock(block, matches)
        newBody.push(anchoredBlock)
    }

    return {
        ...content,
        body: newBody,
    }
}

/**
 * Get the primary spans from a block (if it has any).
 * Returns an empty array for blocks without spans.
 */
function getBlockSpans(block: OwidEnrichedGdocBlock): Span[] {
    return match(block)
        .with({ type: "text" }, (b) => b.value)
        .with({ type: "heading" }, (b) => b.text)
        .with({ type: "aside" }, (b) => b.caption)
        .otherwise(() => [])
}
