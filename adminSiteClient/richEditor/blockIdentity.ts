import { Editor, Extension } from "@tiptap/core"
import { Plugin, PluginKey, Transaction } from "@tiptap/pm/state"
import { Node as PmNode } from "@tiptap/pm/model"
import { nanoid } from "nanoid"
import { isIdentifiedNodeName } from "../../adminShared/richEditor/serialization/pmJson.js"

// Assigns stable block ids: every framed block node (see identifiedNodeNames)
// gets a unique `blockId` attr the moment it appears in the document —
// inserted from the palette, pasted, split off, or loaded from a draft that
// predates block ids. Duplicates (paste carries the source's id via
// ProseMirror's slice metadata) keep the first occurrence in document order
// and regenerate the rest, so an existing block never loses its identity to
// a copy. Runs as appendTransaction, so the fix lands in the same undo step
// and, under collaboration, syncs like any other local edit.

export function newBlockId(): string {
    return nanoid(10)
}

interface BlockIdFix {
    pos: number
    node: PmNode
}

function findMissingOrDuplicateIds(doc: PmNode): BlockIdFix[] {
    const seen = new Set<string>()
    const fixes: BlockIdFix[] = []
    doc.descendants((node, pos) => {
        if (!isIdentifiedNodeName(node.type.name)) return
        const blockId = node.attrs.blockId as string | null
        if (blockId && !seen.has(blockId)) {
            seen.add(blockId)
        } else {
            fixes.push({ pos, node })
        }
    })
    return fixes
}

/**
 * Assign ids to a freshly loaded document (drafts predating block ids).
 * Loading content does not produce a transaction, so the plugin below never
 * sees it; the editor calls this once on create. Deliberately not silent:
 * the assigned ids must reach the next save, or they would regenerate on
 * every load and block-anchored comments could never stick.
 */
export function ensureBlockIds(editor: Editor): void {
    const fixes = findMissingOrDuplicateIds(editor.state.doc)
    if (fixes.length === 0) return
    const { tr } = editor.state
    for (const { pos, node } of fixes) {
        tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            blockId: newBlockId(),
        })
    }
    tr.setMeta("addToHistory", false)
    editor.view.dispatch(tr)
}

const blockIdAssignmentKey = new PluginKey("blockIdAssignment")

export const BlockIdAssignment = Extension.create({
    name: "blockIdAssignment",

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: blockIdAssignmentKey,
                appendTransaction: (
                    transactions,
                    _oldState,
                    newState
                ): Transaction | null => {
                    if (!transactions.some((tr) => tr.docChanged)) return null
                    const fixes = findMissingOrDuplicateIds(newState.doc)
                    if (fixes.length === 0) return null
                    const tr = newState.tr
                    for (const { pos, node } of fixes) {
                        tr.setNodeMarkup(pos, undefined, {
                            ...node.attrs,
                            blockId: newBlockId(),
                        })
                    }
                    return tr
                },
            }),
        ]
    },
})
