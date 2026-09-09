import { expect, it, describe } from "vitest"

import { CommentTargetType, CommentWithAuthor } from "@ourworldindata/types"
import { groupIntoThreads } from "./useComments.js"

/**
 * The API returns comments createdAt ascending, so grouping must not reorder
 * them. Asserted because the two halves drifted apart once already: roots were
 * reversed while replies were not, which read down inside a thread and up
 * between them.
 */
function comment(
    id: number,
    parentId: number | null,
    content: string
): CommentWithAuthor {
    return {
        id,
        parentId,
        content,
        targetType: CommentTargetType.MultiDim,
        targetId: 1,
        targetKey: null,
        anchor: "title",
        viewState: null,
        userId: 1,
        resolvedAt: null,
        resolvedByUserId: null,
        createdAt: new Date(2026, 0, id),
        updatedAt: new Date(2026, 0, id),
        authorFullName: "Someone",
        resolvedByFullName: null,
    }
}

describe(groupIntoThreads, () => {
    it("keeps threads in the order they were started", () => {
        const threads = groupIntoThreads([
            comment(1, null, "first thread"),
            comment(2, null, "second thread"),
            comment(3, null, "third thread"),
        ])

        expect(threads.map((t) => t.root.content)).toEqual([
            "first thread",
            "second thread",
            "third thread",
        ])
    })

    it("keeps replies in the order they were written", () => {
        const threads = groupIntoThreads([
            comment(1, null, "root"),
            comment(2, 1, "first reply"),
            comment(3, 1, "second reply"),
        ])

        expect(threads).toHaveLength(1)
        expect(threads[0].replies.map((r) => r.content)).toEqual([
            "first reply",
            "second reply",
        ])
    })

    it("reads the same direction between threads as within one", () => {
        const threads = groupIntoThreads([
            comment(1, null, "a"),
            comment(2, 1, "a reply"),
            comment(3, null, "b"),
        ])

        // Both orderings ascend by id; neither is reversed
        expect(threads.map((t) => t.root.id)).toEqual([1, 3])
        expect(threads[0].replies.map((r) => r.id)).toEqual([2])
    })

    it("attaches each reply to its own thread", () => {
        const threads = groupIntoThreads([
            comment(1, null, "a"),
            comment(2, null, "b"),
            comment(3, 1, "reply to a"),
            comment(4, 2, "reply to b"),
        ])

        expect(threads[0].replies.map((r) => r.content)).toEqual(["reply to a"])
        expect(threads[1].replies.map((r) => r.content)).toEqual(["reply to b"])
    })
})
