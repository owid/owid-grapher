import { Editor } from "@tiptap/core"
import { NodeSelection } from "@tiptap/pm/state"
import { Node as PmNode } from "@tiptap/pm/model"
import * as Y from "yjs"
import {
    absolutePositionToRelativePosition,
    relativePositionToAbsolutePosition,
} from "@tiptap/y-tiptap"
import { RichEditorSelectionRef } from "../../adminShared/RichEditorTypes.js"
import { inspectedBlockFromSelection } from "./inspection.js"
import { findBlockIdPositions } from "./comments.js"
import { syncPluginKey } from "./ySync.js"

// SelectionRef: the serializable "do X with *this*" — capture the current
// selection as a durable reference, hand it to something asynchronous (a
// comment thread, an agent command), and resolve it back later against a
// document that has kept changing. Block refs ride the stable block ids;
// text refs ride Yjs relative positions in sync mode (they survive
// concurrent edits) and absolute positions otherwise.

const MAX_EXCERPT_LENGTH = 512

/** The framed top-level block containing a position, if it has an id */
function containingBlockId(editor: Editor, pos: number): string | null {
    const resolved = editor.state.doc.resolve(pos)
    if (resolved.depth < 1) return null
    const topLevelBlock = resolved.node(1)
    return (topLevelBlock.attrs.blockId as string | null) ?? null
}

export function selectionRefFromEditor(editor: Editor): RichEditorSelectionRef {
    const selection = editor.state.selection

    if (selection instanceof NodeSelection) {
        const inspected = inspectedBlockFromSelection(editor)
        if (inspected?.blockId) {
            return {
                kind: "block",
                blockId: inspected.blockId,
                blockType: inspected.blockType,
            }
        }
        return { kind: "document" }
    }

    if (!selection.empty) {
        const { anchor, head, from, to } = selection
        const excerpt = editor.state.doc
            .textBetween(from, to, " ")
            .slice(0, MAX_EXCERPT_LENGTH)
        const blockId = containingBlockId(editor, from)

        const ystate = syncPluginKey.getState(editor.state)
        if (ystate?.binding && ystate.binding.mapping.size > 0) {
            return {
                kind: "text",
                anchor: Y.relativePositionToJSON(
                    absolutePositionToRelativePosition(
                        anchor,
                        ystate.type,
                        ystate.binding.mapping
                    )
                ),
                head: Y.relativePositionToJSON(
                    absolutePositionToRelativePosition(
                        head,
                        ystate.type,
                        ystate.binding.mapping
                    )
                ),
                blockId,
                excerpt,
            }
        }
        return {
            kind: "text",
            absoluteAnchor: anchor,
            absoluteHead: head,
            blockId,
            excerpt,
        }
    }

    return { kind: "document" }
}

export type ResolvedSelectionRef =
    | { kind: "document" }
    | { kind: "block"; pos: number; node: PmNode }
    | { kind: "text"; anchor: number; head: number }

/**
 * Resolve a captured ref against the editor's current document. Returns
 * null when the target no longer exists (block deleted, text range gone,
 * ref from a different document generation) — the orphan state.
 */
export function resolveSelectionRef(
    editor: Editor,
    ref: RichEditorSelectionRef
): ResolvedSelectionRef | null {
    if (ref.kind === "document") return { kind: "document" }

    if (ref.kind === "block") {
        const pos = findBlockIdPositions(editor).get(ref.blockId)
        if (pos === undefined) return null
        const node = editor.state.doc.nodeAt(pos)
        if (!node) return null
        return { kind: "block", pos, node }
    }

    const docSize = editor.state.doc.content.size
    if (ref.anchor !== undefined && ref.head !== undefined) {
        const ystate = syncPluginKey.getState(editor.state)
        if (!ystate?.binding) return null
        const anchor = relativePositionToAbsolutePosition(
            ystate.doc,
            ystate.type,
            Y.createRelativePositionFromJSON(ref.anchor),
            ystate.binding.mapping
        )
        const head = relativePositionToAbsolutePosition(
            ystate.doc,
            ystate.type,
            Y.createRelativePositionFromJSON(ref.head),
            ystate.binding.mapping
        )
        if (anchor === null || head === null) return null
        return {
            kind: "text",
            anchor: Math.min(anchor, docSize),
            head: Math.min(head, docSize),
        }
    }

    if (ref.absoluteAnchor !== undefined && ref.absoluteHead !== undefined) {
        if (ref.absoluteAnchor > docSize || ref.absoluteHead > docSize)
            return null
        return {
            kind: "text",
            anchor: ref.absoluteAnchor,
            head: ref.absoluteHead,
        }
    }

    return null
}
