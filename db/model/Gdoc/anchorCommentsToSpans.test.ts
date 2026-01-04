import { describe, expect, it } from "vitest"
import { anchorCommentsToContent } from "./anchorCommentsToSpans.js"
import {
    GdocComments,
    OwidGdocPostContent,
    OwidGdocType,
    EnrichedBlockText,
    Span,
    SpanCommentRef,
    SpanBold,
    SpanItalic,
    SpanLink,
    SpanUnderline,
} from "@ourworldindata/types"

describe("anchorCommentsToContent", () => {
    const makeContent = (body: EnrichedBlockText[]): OwidGdocPostContent => ({
        type: OwidGdocType.Article,
        authors: [],
        body,
    })

    const makeTextBlock = (spans: Span[]): EnrichedBlockText => ({
        type: "text",
        value: spans,
        parseErrors: [],
    })

    const makeComments = (
        threads: Array<{ id: string; quotedText: string }>
    ): GdocComments => ({
        threads: threads.map((t) => ({
            id: t.id,
            author: "test@example.com",
            content: "Test comment",
            quotedText: t.quotedText,
            createdTime: "2024-01-01T00:00:00Z",
            modifiedTime: "2024-01-01T00:00:00Z",
            resolved: false,
            replies: [],
        })),
        fetchedAt: "2024-01-01T00:00:00Z",
    })

    it("returns content unchanged when no comments", () => {
        const content = makeContent([
            makeTextBlock([
                { spanType: "span-simple-text", text: "Hello world" },
            ]),
        ])

        const result = anchorCommentsToContent(content, null)
        expect(result).toEqual(content)
    })

    it("returns content unchanged when comments have empty threads", () => {
        const content = makeContent([
            makeTextBlock([
                { spanType: "span-simple-text", text: "Hello world" },
            ]),
        ])

        const result = anchorCommentsToContent(content, {
            threads: [],
            fetchedAt: "2024-01-01T00:00:00Z",
        })
        expect(result).toEqual(content)
    })

    it("anchors a simple comment to matching text", () => {
        const content = makeContent([
            makeTextBlock([
                { spanType: "span-simple-text", text: "Hello world" },
            ]),
        ])

        const comments = makeComments([{ id: "c1", quotedText: "world" }])
        const result = anchorCommentsToContent(content, comments)

        expect(result.body).toBeDefined()
        const body = result.body as EnrichedBlockText[]
        expect(body.length).toBe(1)

        const textBlock = body[0]
        expect(textBlock.type).toBe("text")
        expect(textBlock.value.length).toBe(2) // "Hello " + comment-ref wrapping "world"

        const [beforeSpan, commentRefSpan] = textBlock.value
        expect(beforeSpan).toEqual({
            spanType: "span-simple-text",
            text: "Hello ",
        })
        expect((commentRefSpan as SpanCommentRef).spanType).toBe(
            "span-comment-ref"
        )
        expect((commentRefSpan as SpanCommentRef).commentId).toBe("c1")
        expect((commentRefSpan as SpanCommentRef).children).toEqual([
            { spanType: "span-simple-text", text: "world" },
        ])
    })

    it("handles comment at the beginning of text", () => {
        const content = makeContent([
            makeTextBlock([
                { spanType: "span-simple-text", text: "Hello world" },
            ]),
        ])

        const comments = makeComments([{ id: "c1", quotedText: "Hello" }])
        const result = anchorCommentsToContent(content, comments)

        const body = result.body as EnrichedBlockText[]
        const textBlock = body[0]
        expect(textBlock.value.length).toBe(2) // comment-ref wrapping "Hello" + " world"

        const [commentRefSpan, afterSpan] = textBlock.value
        expect((commentRefSpan as SpanCommentRef).spanType).toBe(
            "span-comment-ref"
        )
        expect((commentRefSpan as SpanCommentRef).children).toEqual([
            { spanType: "span-simple-text", text: "Hello" },
        ])
        expect(afterSpan).toEqual({
            spanType: "span-simple-text",
            text: " world",
        })
    })

    it("handles comment spanning entire text", () => {
        const content = makeContent([
            makeTextBlock([{ spanType: "span-simple-text", text: "Hello" }]),
        ])

        const comments = makeComments([{ id: "c1", quotedText: "Hello" }])
        const result = anchorCommentsToContent(content, comments)

        const body = result.body as EnrichedBlockText[]
        const textBlock = body[0]
        expect(textBlock.value.length).toBe(1)

        const commentRefSpan = textBlock.value[0] as SpanCommentRef
        expect(commentRefSpan.spanType).toBe("span-comment-ref")
        expect(commentRefSpan.commentId).toBe("c1")
        expect(commentRefSpan.children).toEqual([
            { spanType: "span-simple-text", text: "Hello" },
        ])
    })

    it("skips comments with no matching text", () => {
        const content = makeContent([
            makeTextBlock([
                { spanType: "span-simple-text", text: "Hello world" },
            ]),
        ])

        const comments = makeComments([{ id: "c1", quotedText: "goodbye" }])
        const result = anchorCommentsToContent(content, comments)

        // Content should be unchanged (deep equal check)
        const body = result.body as EnrichedBlockText[]
        expect(body[0].value).toEqual([
            { spanType: "span-simple-text", text: "Hello world" },
        ])
    })

    it("only matches first occurrence when text appears multiple times", () => {
        const content = makeContent([
            makeTextBlock([
                { spanType: "span-simple-text", text: "apple banana apple" },
            ]),
        ])

        const comments = makeComments([{ id: "c1", quotedText: "apple" }])
        const result = anchorCommentsToContent(content, comments)

        const body = result.body as EnrichedBlockText[]
        const textBlock = body[0]

        // Should have: comment-ref("apple") + " banana apple"
        expect(textBlock.value.length).toBe(2)
        const [commentRefSpan, restSpan] = textBlock.value
        expect((commentRefSpan as SpanCommentRef).spanType).toBe(
            "span-comment-ref"
        )
        expect(restSpan).toEqual({
            spanType: "span-simple-text",
            text: " banana apple",
        })
    })

    it("handles multiple comments in order", () => {
        const content = makeContent([
            makeTextBlock([
                { spanType: "span-simple-text", text: "Hello beautiful world" },
            ]),
        ])

        const comments = makeComments([
            { id: "c1", quotedText: "Hello" },
            { id: "c2", quotedText: "world" },
        ])
        const result = anchorCommentsToContent(content, comments)

        const body = result.body as EnrichedBlockText[]
        const textBlock = body[0]

        // Should have: comment-ref("Hello") + " beautiful " + comment-ref("world")
        expect(textBlock.value.length).toBe(3)
        expect((textBlock.value[0] as SpanCommentRef).commentId).toBe("c1")
        expect(textBlock.value[1]).toEqual({
            spanType: "span-simple-text",
            text: " beautiful ",
        })
        expect((textBlock.value[2] as SpanCommentRef).commentId).toBe("c2")
    })

    // =========================================================================
    // Phase 4: Cross-Span Comment Anchoring Tests
    // =========================================================================

    describe("cross-span matching", () => {
        /**
         * Helper to create a bold span
         */
        const bold = (children: Span[]): SpanBold => ({
            spanType: "span-bold",
            children,
        })

        /**
         * Helper to create an italic span
         */
        const italic = (children: Span[]): SpanItalic => ({
            spanType: "span-italic",
            children,
        })

        /**
         * Helper to create an underline span
         */
        const underline = (children: Span[]): SpanUnderline => ({
            spanType: "span-underline",
            children,
        })

        /**
         * Helper to create a link span
         */
        const link = (
            children: Span[],
            url: string = "http://example.com"
        ): SpanLink => ({
            spanType: "span-link",
            children,
            url,
        })

        /**
         * Helper to create a simple text span
         */
        const text = (t: string): Span => ({
            spanType: "span-simple-text",
            text: t,
        })

        it("handles match spanning two sibling spans", () => {
            // <b>Hello </b><i>world</i>
            // Quote: "o wo" (crosses from bold into italic)
            const content = makeContent([
                makeTextBlock([
                    bold([text("Hello ")]),
                    italic([text("world")]),
                ]),
            ])

            const comments = makeComments([{ id: "c1", quotedText: "o wo" }])
            const result = anchorCommentsToContent(content, comments)

            const body = result.body as EnrichedBlockText[]
            const spans = body[0].value

            // Expected structure:
            // <b>Hell</b>
            // <comment-ref>
            //   <b>o </b>
            //   <i>wo</i>
            // </comment-ref>
            // <i>rld</i>

            expect(spans.length).toBe(3)

            // First: <b>Hell</b>
            expect(spans[0]).toEqual(bold([text("Hell")]))

            // Second: comment-ref containing <b>o </b><i>wo</i>
            const commentRef = spans[1] as SpanCommentRef
            expect(commentRef.spanType).toBe("span-comment-ref")
            expect(commentRef.commentId).toBe("c1")
            expect(commentRef.children.length).toBe(2)
            expect(commentRef.children[0]).toEqual(bold([text("o ")]))
            expect(commentRef.children[1]).toEqual(italic([text("wo")]))

            // Third: <i>rld</i>
            expect(spans[2]).toEqual(italic([text("rld")]))
        })

        it("handles match spanning from nested structure into sibling", () => {
            // <b><i>Hello</i></b><u>world</u>
            // Quote: "llowor" (crosses from nested bold>italic into underline)
            // Note: no space - the spans are adjacent
            const content = makeContent([
                makeTextBlock([
                    bold([italic([text("Hello")])]),
                    underline([text("world")]),
                ]),
            ])

            const comments = makeComments([{ id: "c1", quotedText: "llowor" }])
            const result = anchorCommentsToContent(content, comments)

            const body = result.body as EnrichedBlockText[]
            const spans = body[0].value

            // Expected structure:
            // <b><i>He</i></b>
            // <comment-ref>
            //   <b><i>llo</i></b>
            //   <u>wor</u>
            // </comment-ref>
            // <u>ld</u>

            expect(spans.length).toBe(3)

            // First: <b><i>He</i></b>
            expect(spans[0]).toEqual(bold([italic([text("He")])]))

            // Second: comment-ref containing nested structure
            const commentRef = spans[1] as SpanCommentRef
            expect(commentRef.spanType).toBe("span-comment-ref")
            expect(commentRef.commentId).toBe("c1")
            expect(commentRef.children.length).toBe(2)
            expect(commentRef.children[0]).toEqual(
                bold([italic([text("llo")])])
            )
            expect(commentRef.children[1]).toEqual(underline([text("wor")]))

            // Third: <u>ld</u>
            expect(spans[2]).toEqual(underline([text("ld")]))
        })

        it("handles match spanning from deep nesting to shallow sibling", () => {
            // <b><i><u>deep</u></i></b><link>shallow</link>
            // Quote: "eepsha" (from deep nesting to link)
            // Note: no space - the spans are adjacent
            const content = makeContent([
                makeTextBlock([
                    bold([italic([underline([text("deep")])])]),
                    link([text("shallow")]),
                ]),
            ])

            const comments = makeComments([{ id: "c1", quotedText: "eepsha" }])
            const result = anchorCommentsToContent(content, comments)

            const body = result.body as EnrichedBlockText[]
            const spans = body[0].value

            // Expected structure:
            // <b><i><u>d</u></i></b>
            // <comment-ref>
            //   <b><i><u>eep</u></i></b>
            //   <link>sha</link>
            // </comment-ref>
            // <link>llow</link>

            expect(spans.length).toBe(3)

            // First: <b><i><u>d</u></i></b>
            expect(spans[0]).toEqual(bold([italic([underline([text("d")])])]))

            // Second: comment-ref
            const commentRef = spans[1] as SpanCommentRef
            expect(commentRef.spanType).toBe("span-comment-ref")
            expect(commentRef.children.length).toBe(2)
            expect(commentRef.children[0]).toEqual(
                bold([italic([underline([text("eep")])])])
            )
            expect(commentRef.children[1]).toEqual(link([text("sha")]))

            // Third: <link>llow</link>
            expect(spans[2]).toEqual(link([text("llow")]))
        })

        it("handles match spanning entire nested structure plus partial sibling", () => {
            // <b>Hello</b><i>world</i>
            // Quote: "Hello wor" (entire bold + partial italic)
            const content = makeContent([
                makeTextBlock([bold([text("Hello")]), italic([text("world")])]),
            ])

            const comments = makeComments([
                { id: "c1", quotedText: "Hellowor" },
            ])
            const result = anchorCommentsToContent(content, comments)

            const body = result.body as EnrichedBlockText[]
            const spans = body[0].value

            // Expected structure:
            // <comment-ref>
            //   <b>Hello</b>
            //   <i>wor</i>
            // </comment-ref>
            // <i>ld</i>

            expect(spans.length).toBe(2)

            // First: comment-ref containing both
            const commentRef = spans[0] as SpanCommentRef
            expect(commentRef.spanType).toBe("span-comment-ref")
            expect(commentRef.children.length).toBe(2)
            expect(commentRef.children[0]).toEqual(bold([text("Hello")]))
            expect(commentRef.children[1]).toEqual(italic([text("wor")]))

            // Second: <i>ld</i>
            expect(spans[1]).toEqual(italic([text("ld")]))
        })

        it("handles match crossing multiple siblings", () => {
            // <b>A</b><i>B</i><u>C</u>
            // Quote: "ABC" (crosses all three)
            const content = makeContent([
                makeTextBlock([
                    bold([text("A")]),
                    italic([text("B")]),
                    underline([text("C")]),
                ]),
            ])

            const comments = makeComments([{ id: "c1", quotedText: "ABC" }])
            const result = anchorCommentsToContent(content, comments)

            const body = result.body as EnrichedBlockText[]
            const spans = body[0].value

            // Expected structure:
            // <comment-ref>
            //   <b>A</b>
            //   <i>B</i>
            //   <u>C</u>
            // </comment-ref>

            expect(spans.length).toBe(1)

            const commentRef = spans[0] as SpanCommentRef
            expect(commentRef.spanType).toBe("span-comment-ref")
            expect(commentRef.children.length).toBe(3)
            expect(commentRef.children[0]).toEqual(bold([text("A")]))
            expect(commentRef.children[1]).toEqual(italic([text("B")]))
            expect(commentRef.children[2]).toEqual(underline([text("C")]))
        })

        it("handles match at exact span boundary (start)", () => {
            // <b>Hello</b><i>world</i>
            // Quote: "Hello" (exactly the bold span)
            const content = makeContent([
                makeTextBlock([bold([text("Hello")]), italic([text("world")])]),
            ])

            const comments = makeComments([{ id: "c1", quotedText: "Hello" }])
            const result = anchorCommentsToContent(content, comments)

            const body = result.body as EnrichedBlockText[]
            const spans = body[0].value

            // Expected structure:
            // <comment-ref>
            //   <b>Hello</b>
            // </comment-ref>
            // <i>world</i>

            expect(spans.length).toBe(2)

            const commentRef = spans[0] as SpanCommentRef
            expect(commentRef.spanType).toBe("span-comment-ref")
            expect(commentRef.children.length).toBe(1)
            expect(commentRef.children[0]).toEqual(bold([text("Hello")]))

            expect(spans[1]).toEqual(italic([text("world")]))
        })

        it("handles match at exact span boundary (end)", () => {
            // <b>Hello</b><i>world</i>
            // Quote: "world" (exactly the italic span)
            const content = makeContent([
                makeTextBlock([bold([text("Hello")]), italic([text("world")])]),
            ])

            const comments = makeComments([{ id: "c1", quotedText: "world" }])
            const result = anchorCommentsToContent(content, comments)

            const body = result.body as EnrichedBlockText[]
            const spans = body[0].value

            // Expected structure:
            // <b>Hello</b>
            // <comment-ref>
            //   <i>world</i>
            // </comment-ref>

            expect(spans.length).toBe(2)

            expect(spans[0]).toEqual(bold([text("Hello")]))

            const commentRef = spans[1] as SpanCommentRef
            expect(commentRef.spanType).toBe("span-comment-ref")
            expect(commentRef.children.length).toBe(1)
            expect(commentRef.children[0]).toEqual(italic([text("world")]))
        })
    })

    describe("nested comments", () => {
        it("handles outer comment containing inner comment", () => {
            // Text: "Hello world"
            // Comments: "Hello world" (outer) and "world" (inner)
            // Inner should be nested inside outer
            const content = makeContent([
                makeTextBlock([
                    { spanType: "span-simple-text", text: "Hello world" },
                ]),
            ])

            const comments = makeComments([
                { id: "outer", quotedText: "Hello world" },
                { id: "inner", quotedText: "world" },
            ])
            const result = anchorCommentsToContent(content, comments)

            const body = result.body as EnrichedBlockText[]
            const spans = body[0].value

            // Expected structure:
            // <comment-ref id="outer">
            //   Hello
            //   <comment-ref id="inner">world</comment-ref>
            // </comment-ref>

            expect(spans.length).toBe(1)

            const outer = spans[0] as SpanCommentRef
            expect(outer.spanType).toBe("span-comment-ref")
            expect(outer.commentId).toBe("outer")
            expect(outer.children.length).toBe(2)

            expect(outer.children[0]).toEqual({
                spanType: "span-simple-text",
                text: "Hello ",
            })

            const inner = outer.children[1] as SpanCommentRef
            expect(inner.spanType).toBe("span-comment-ref")
            expect(inner.commentId).toBe("inner")
            expect(inner.children).toEqual([
                { spanType: "span-simple-text", text: "world" },
            ])
        })

        it("skips overlapping comments (keeps first, skips second)", () => {
            // Text: "Hello world today"
            // Comments: "Hello wor" and "world today" (overlapping)
            // Second should be skipped since they overlap
            const content = makeContent([
                makeTextBlock([
                    { spanType: "span-simple-text", text: "Hello world today" },
                ]),
            ])

            const comments = makeComments([
                { id: "c1", quotedText: "Hello wor" },
                { id: "c2", quotedText: "world today" },
            ])
            const result = anchorCommentsToContent(content, comments)

            const body = result.body as EnrichedBlockText[]
            const spans = body[0].value

            // Expected: only c1 is anchored, c2 is skipped due to overlap
            // <comment-ref id="c1">Hello wor</comment-ref>ld today

            expect(spans.length).toBe(2)

            const commentRef = spans[0] as SpanCommentRef
            expect(commentRef.spanType).toBe("span-comment-ref")
            expect(commentRef.commentId).toBe("c1")

            expect(spans[1]).toEqual({
                spanType: "span-simple-text",
                text: "ld today",
            })
        })
    })

    describe("edge cases", () => {
        it("handles empty text spans gracefully", () => {
            // <b></b><i>Hello</i>
            // Quote: "Hello"
            const content = makeContent([
                makeTextBlock([
                    { spanType: "span-bold", children: [] },
                    {
                        spanType: "span-italic",
                        children: [
                            { spanType: "span-simple-text", text: "Hello" },
                        ],
                    },
                ]),
            ])

            const comments = makeComments([{ id: "c1", quotedText: "Hello" }])
            const result = anchorCommentsToContent(content, comments)

            const body = result.body as EnrichedBlockText[]
            const spans = body[0].value

            // The empty bold should be preserved, comment-ref wraps italic
            // Actual behavior may vary - this test documents expected behavior
            expect(spans.length).toBeGreaterThanOrEqual(1)

            // Find the comment ref
            const commentRef = spans.find(
                (s) => s.spanType === "span-comment-ref"
            ) as SpanCommentRef
            expect(commentRef).toBeDefined()
            expect(commentRef.commentId).toBe("c1")
        })

        it("handles match within nested structure (no cross-span)", () => {
            // <b><i>Hello world</i></b>
            // Quote: "world" (entirely within nested structure)
            const content = makeContent([
                makeTextBlock([
                    {
                        spanType: "span-bold",
                        children: [
                            {
                                spanType: "span-italic",
                                children: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "Hello world",
                                    },
                                ],
                            },
                        ],
                    },
                ]),
            ])

            const comments = makeComments([{ id: "c1", quotedText: "world" }])
            const result = anchorCommentsToContent(content, comments)

            const body = result.body as EnrichedBlockText[]
            const spans = body[0].value

            // Current behavior: comment-ref is created at top level with nesting preserved inside
            // <b><i>Hello </i></b><comment-ref><b><i>world</i></b></comment-ref>
            // Note: An alternative would be to nest the comment-ref inside the bold>italic,
            // but that would require more complex logic to detect single-subtree matches.

            expect(spans.length).toBe(2)

            // First: <b><i>Hello </i></b>
            const beforeSpan = spans[0] as SpanBold
            expect(beforeSpan.spanType).toBe("span-bold")
            expect((beforeSpan.children[0] as SpanItalic).spanType).toBe(
                "span-italic"
            )

            // Second: <comment-ref><b><i>world</i></b></comment-ref>
            const commentRef = spans[1] as SpanCommentRef
            expect(commentRef.spanType).toBe("span-comment-ref")
            expect(commentRef.commentId).toBe("c1")
            expect(commentRef.children.length).toBe(1)

            const innerBold = commentRef.children[0] as SpanBold
            expect(innerBold.spanType).toBe("span-bold")
        })

        it("filters out empty spans after splitting", () => {
            // <b>Hello</b><i>world</i>
            // Quote: "Helloworld" (entire content)
            const content = makeContent([
                makeTextBlock([
                    {
                        spanType: "span-bold",
                        children: [
                            { spanType: "span-simple-text", text: "Hello" },
                        ],
                    },
                    {
                        spanType: "span-italic",
                        children: [
                            { spanType: "span-simple-text", text: "world" },
                        ],
                    },
                ]),
            ])

            const comments = makeComments([
                { id: "c1", quotedText: "Helloworld" },
            ])
            const result = anchorCommentsToContent(content, comments)

            const body = result.body as EnrichedBlockText[]
            const spans = body[0].value

            // Expected: single comment-ref wrapping everything
            // No empty spans before or after
            expect(spans.length).toBe(1)

            const commentRef = spans[0] as SpanCommentRef
            expect(commentRef.spanType).toBe("span-comment-ref")
            expect(commentRef.children.length).toBe(2)
        })
    })
})
