import { Editor, Mark } from "@tiptap/core"
import { RichEditorCommentAnchorUpdate } from "../../adminShared/RichEditorTypes.js"
import type { RichEditorCommentThread } from "../../adminShared/RichEditorTypes.js"

// Comment threads are anchored to text ranges via an editor-only `comment`
// mark carrying the thread id. Marks move naturally with edits, survive
// splits/joins and undo; they are stripped during serialization
// (EDITOR_ONLY_MARKS), so they never leak into the enriched content. The
// canonical anchor positions live server-side and are refreshed with every
// save from the marks' current positions.

export const COMMENT_MARK_NAME = "comment"

export const CommentMark = Mark.create({
    name: COMMENT_MARK_NAME,

    // typing at the edge of a comment should not extend it
    inclusive: false,

    addAttributes() {
        return { threadId: { default: null } }
    },

    parseHTML() {
        return [{ tag: "span[data-rich-comment-thread]" }]
    },

    renderHTML({ mark }) {
        return [
            "span",
            {
                "data-rich-comment-thread": String(mark.attrs.threadId ?? ""),
                class: "rich-comment-highlight",
            },
            0,
        ]
    },
})

const MAX_ANCHOR_TEXT_LENGTH = 512

/** Apply comment marks for range threads loaded from the server. */
export function applyCommentMarks(
    editor: Editor,
    threads: RichEditorCommentThread[]
): void {
    const markType = editor.schema.marks[COMMENT_MARK_NAME]
    if (!markType) return
    const { tr, doc } = editor.state
    let changed = false
    for (const thread of threads) {
        if (thread.anchorType !== "range" || thread.status === "orphaned")
            continue
        if (thread.anchorFrom === null || thread.anchorTo === null) continue
        const from = Math.max(0, Math.min(thread.anchorFrom, doc.content.size))
        const to = Math.max(0, Math.min(thread.anchorTo, doc.content.size))
        if (from >= to) continue
        tr.addMark(from, to, markType.create({ threadId: thread.id }))
        changed = true
    }
    if (changed) {
        tr.setMeta("addToHistory", false)
        tr.setMeta("richEditorSilent", true)
        editor.view.dispatch(tr)
    }
}

/** Add a comment mark for a freshly created thread on the given range. */
export function addCommentMark(
    editor: Editor,
    threadId: number,
    from: number,
    to: number
): void {
    const markType = editor.schema.marks[COMMENT_MARK_NAME]
    if (!markType) return
    const { tr } = editor.state
    tr.addMark(from, to, markType.create({ threadId }))
    tr.setMeta("addToHistory", false)
    editor.view.dispatch(tr)
}

interface MarkRange {
    from: number
    to: number
}

/** Find the current position of every comment mark in the doc. */
export function findCommentMarkRanges(editor: Editor): Map<number, MarkRange> {
    const ranges = new Map<number, MarkRange>()
    editor.state.doc.descendants((node, pos) => {
        for (const mark of node.marks) {
            if (mark.type.name !== COMMENT_MARK_NAME) continue
            const threadId = Number(mark.attrs.threadId)
            if (!threadId) continue
            const existing = ranges.get(threadId)
            const from = existing ? Math.min(existing.from, pos) : pos
            const to = existing
                ? Math.max(existing.to, pos + node.nodeSize)
                : pos + node.nodeSize
            ranges.set(threadId, { from, to })
        }
    })
    return ranges
}

/**
 * Compute the anchor updates to send with a save: the current position of
 * every range thread's mark, and orphaned status for threads whose mark was
 * deleted along with its text.
 */
export function collectCommentAnchors(
    editor: Editor,
    threads: RichEditorCommentThread[]
): RichEditorCommentAnchorUpdate[] {
    const ranges = findCommentMarkRanges(editor)
    const updates: RichEditorCommentAnchorUpdate[] = []
    for (const thread of threads) {
        if (thread.anchorType !== "range") continue
        const range = ranges.get(thread.id)
        if (range) {
            updates.push({
                threadId: thread.id,
                anchorFrom: range.from,
                anchorTo: range.to,
                anchorText: editor.state.doc
                    .textBetween(range.from, range.to, " ")
                    .slice(0, MAX_ANCHOR_TEXT_LENGTH),
                orphaned: false,
            })
        } else if (thread.status !== "orphaned") {
            updates.push({
                threadId: thread.id,
                anchorFrom: null,
                anchorTo: null,
                anchorText: thread.anchorText,
                orphaned: true,
            })
        }
    }
    return updates
}

/** Scroll to and briefly flash a thread's highlight in the canvas. */
export function focusCommentThread(editor: Editor, threadId: number): void {
    const range = findCommentMarkRanges(editor).get(threadId)
    if (!range) return
    editor.chain().focus().setTextSelection(range.from).run()
    const dom = editor.view.dom.querySelector(
        `[data-rich-comment-thread="${threadId}"]`
    )
    dom?.scrollIntoView({ behavior: "smooth", block: "center" })
}
