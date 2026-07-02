import { Editor } from "@tiptap/core"
import { NodeSelection } from "@tiptap/pm/state"
import {
    pmNodeNames,
    propsAtomBlockTypes,
    twoColumnBlockTypes,
} from "./serialization/pmJson.js"

// Component selection: selecting a block node (by clicking its hover border
// or its body) derives an InspectedBlock from the NodeSelection, which the
// page shows in the right-rail block inspector. All edits from the inspector
// are applied as ProseMirror transactions, so undo/redo covers them.

export interface InspectedBlock {
    /** ProseMirror node type name */
    nodeType: string
    /** Enriched block type, e.g. "chart" */
    blockType: string
    /**
     * How the inspector's props map onto the node: the `props` attr of a
     * props atom, the node attrs directly, the opaque JSON of a raw block,
     * or a container without settings of its own
     */
    kind: "props" | "attrs" | "raw" | "container"
    props: Record<string, unknown>
    updateProps: (props: Record<string, unknown>) => void
    deleteBlock: () => void
}

const nodeNameToPropsAtomBlockType = Object.fromEntries(
    Object.entries(propsAtomBlockTypes).map(([blockType, nodeName]) => [
        nodeName,
        blockType,
    ])
)

const nodeNameToContainerBlockType: Record<string, string> = {
    ...Object.fromEntries(
        Object.entries(twoColumnBlockTypes).map(([blockType, nodeName]) => [
            nodeName,
            blockType,
        ])
    ),
    [pmNodeNames.graySection]: "gray-section",
    [pmNodeNames.expandableParagraph]: "expandable-paragraph",
}

/**
 * A stable key for the currently selected block node (or null when no block
 * is selected). The page uses it to only rebuild the inspector when the
 * selection actually moves to a different block, not on every transaction.
 */
export function selectionBlockKey(editor: Editor): string | null {
    const selection = editor.state.selection
    if (!(selection instanceof NodeSelection)) return null
    return `${selection.node.type.name}:${selection.from}`
}

/** True when a text range (not a block node) is selected */
export function hasTextRangeSelection(editor: Editor): boolean {
    const selection = editor.state.selection
    return !selection.empty && !(selection instanceof NodeSelection)
}

export function inspectedBlockFromSelection(
    editor: Editor
): InspectedBlock | null {
    const selection = editor.state.selection
    if (!(selection instanceof NodeSelection)) return null
    const node = selection.node
    const nodeType = node.type.name

    // Re-reads the selection at call time: the inspector can outlive document
    // changes, and the node's position may have shifted since it was built.
    const updateSelectedNodeAttrs = (
        makeAttrs: (
            currentAttrs: Record<string, unknown>,
            newProps: Record<string, unknown>
        ) => Record<string, unknown>
    ): ((newProps: Record<string, unknown>) => void) => {
        return (newProps) => {
            const current = editor.state.selection
            if (
                !(current instanceof NodeSelection) ||
                current.node.type.name !== nodeType
            )
                return
            editor
                .chain()
                .command(({ tr }) => {
                    tr.setNodeMarkup(
                        current.from,
                        undefined,
                        makeAttrs(current.node.attrs, newProps)
                    )
                    return true
                })
                .run()
        }
    }

    const deleteBlock = (): void => {
        const current = editor.state.selection
        if (!(current instanceof NodeSelection)) return
        editor.chain().focus().deleteSelection().run()
    }

    const propsAtomBlockType = nodeNameToPropsAtomBlockType[nodeType]
    if (propsAtomBlockType) {
        return {
            nodeType,
            blockType: propsAtomBlockType,
            kind: "props",
            props: (node.attrs.props ?? {}) as Record<string, unknown>,
            updateProps: updateSelectedNodeAttrs((attrs, newProps) => ({
                ...attrs,
                props: newProps,
            })),
            deleteBlock,
        }
    }

    if (nodeType === pmNodeNames.image || nodeType === pmNodeNames.cta) {
        return {
            nodeType,
            blockType: nodeType === pmNodeNames.image ? "image" : "cta",
            kind: "attrs",
            props: node.attrs as Record<string, unknown>,
            updateProps: updateSelectedNodeAttrs(
                (_attrs, newProps) => newProps
            ),
            deleteBlock,
        }
    }

    if (nodeType === pmNodeNames.rawBlock) {
        const block = node.attrs.block as { type?: string } | null
        return {
            nodeType,
            blockType: block?.type ?? "unknown",
            kind: "raw",
            props: (block ?? {}) as Record<string, unknown>,
            updateProps: () => undefined,
            deleteBlock,
        }
    }

    const containerBlockType = nodeNameToContainerBlockType[nodeType]
    if (containerBlockType) {
        return {
            nodeType,
            blockType: containerBlockType,
            kind: "container",
            props: {},
            updateProps: () => undefined,
            deleteBlock,
        }
    }

    return null
}

/**
 * Replace the currently selected block with an empty paragraph and put the
 * cursor inside it, so a subsequent insert command lands where the block
 * was. (TipTap replaces empty text blocks when inserting block content, and
 * the transform-style commands — heading, lists, quote — convert them.)
 */
export function replaceSelectedBlockWithCursor(editor: Editor): boolean {
    const selection = editor.state.selection
    if (!(selection instanceof NodeSelection)) return false
    const pos = selection.from
    return editor
        .chain()
        .focus()
        .deleteSelection()
        .insertContentAt(pos, { type: pmNodeNames.paragraph })
        .setTextSelection(pos + 1)
        .run()
}

/**
 * Insert an empty paragraph directly below the currently selected block and
 * put the cursor inside it, so a subsequent insert command lands there.
 */
export function placeCursorBelowSelectedBlock(editor: Editor): boolean {
    const selection = editor.state.selection
    if (!(selection instanceof NodeSelection)) return false
    const pos = selection.to
    return editor
        .chain()
        .focus()
        .insertContentAt(pos, { type: pmNodeNames.paragraph })
        .setTextSelection(pos + 1)
        .run()
}
