import { Editor } from "@tiptap/core"
import { NodeSelection, Transaction } from "@tiptap/pm/state"
import { Node as PmNode, Schema } from "@tiptap/pm/model"
import {
    pmNodeNames,
    propsAtomBlockTypes,
    twoColumnBlockTypes,
} from "./serialization/pmJson.js"

// Component selection: selecting a block node (by clicking its hover border
// or its body) derives an InspectedBlock from the NodeSelection, which the
// page shows in the right-rail block inspector. All edits from the inspector
// are applied as ProseMirror transactions, so undo/redo covers them.

export interface InspectedTableCommands {
    addRow: () => void
    addColumn: () => void
    removeRow: () => void
    removeColumn: () => void
}

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
    /**
     * Current ProseMirror position of the inspected block (re-read from the
     * live selection), or null when the selection moved elsewhere
     */
    getPos: () => number | null
    /** Structural commands, set only for the selected table block */
    tableCommands?: InspectedTableCommands
    /**
     * Convert this block into a narrative-chart block referencing the given
     * name; set only for chart blocks. Returns the block's position.
     */
    convertToNarrativeChart?: (name: string) => number | null
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

// Blocks whose settings are the node attrs, edited directly in the inspector
const nodeNameToAttrsBlockType: Record<string, string> = {
    [pmNodeNames.image]: "image",
    [pmNodeNames.cta]: "cta",
    [pmNodeNames.aside]: "aside",
    [pmNodeNames.blockquote]: "blockquote",
    [pmNodeNames.callout]: "callout",
    [pmNodeNames.pullQuote]: "pull-quote",
    [pmNodeNames.tableBlock]: "table",
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

    const getPos = (): number | null => {
        const current = editor.state.selection
        if (
            !(current instanceof NodeSelection) ||
            current.node.type.name !== nodeType
        )
            return null
        return current.from
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
            getPos,
            ...(nodeType === pmNodeNames.chart
                ? {
                      convertToNarrativeChart: (name: string) =>
                          convertSelectedChartBlockToNarrativeChart(
                              editor,
                              name
                          ),
                  }
                : {}),
        }
    }

    const attrsBlockType = nodeNameToAttrsBlockType[nodeType]
    if (attrsBlockType) {
        return {
            nodeType,
            blockType: attrsBlockType,
            kind: "attrs",
            props: node.attrs as Record<string, unknown>,
            updateProps: updateSelectedNodeAttrs(
                (_attrs, newProps) => newProps
            ),
            deleteBlock,
            getPos,
            ...(nodeType === pmNodeNames.tableBlock
                ? { tableCommands: buildTableCommands(editor) }
                : {}),
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
            getPos,
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
            getPos,
        }
    }

    return null
}

// Structural edits on the selected table: add/remove the last row/column.
// Positions are computed from the live selection at call time; the node
// selection is restored afterwards so the inspector stays open.
function buildTableCommands(editor: Editor): InspectedTableCommands {
    type TableEditArgs = {
        tr: Transaction
        node: PmNode
        pos: number
        schema: Schema
    }
    const withSelectedTable = (
        edit: (args: TableEditArgs) => boolean
    ): (() => void) => {
        return () => {
            const selection = editor.state.selection
            if (
                !(selection instanceof NodeSelection) ||
                selection.node.type.name !== pmNodeNames.tableBlock
            )
                return
            const pos = selection.from
            editor
                .chain()
                .command(({ tr, state }) =>
                    edit({
                        tr,
                        node: selection.node,
                        pos,
                        schema: state.schema,
                    })
                )
                .setNodeSelection(pos)
                .run()
        }
    }

    const emptyCell = (schema: Schema): PmNode =>
        schema.nodes[pmNodeNames.tableCell].create(
            null,
            schema.nodes[pmNodeNames.paragraph].create()
        )

    return {
        addRow: withSelectedTable(({ tr, node, pos, schema }) => {
            const columns = Math.max(node.firstChild?.childCount ?? 1, 1)
            const cells = Array.from({ length: columns }, () =>
                emptyCell(schema)
            )
            const row = schema.nodes[pmNodeNames.tableRow].create(null, cells)
            tr.insert(pos + node.nodeSize - 1, row)
            return true
        }),
        addColumn: withSelectedTable(({ tr, node, pos, schema }) => {
            // insert a cell at the end of every row, applied bottom-up so
            // earlier insertions don't shift later positions
            const insertPositions: number[] = []
            let rowPos = pos + 1
            node.forEach((row) => {
                insertPositions.push(rowPos + row.nodeSize - 1)
                rowPos += row.nodeSize
            })
            for (const insertPos of insertPositions.reverse()) {
                tr.insert(insertPos, emptyCell(schema))
            }
            return true
        }),
        removeRow: withSelectedTable(({ tr, node, pos }) => {
            if (node.childCount <= 1) return false
            const lastRow = node.child(node.childCount - 1)
            const tableEnd = pos + node.nodeSize - 1
            tr.delete(tableEnd - lastRow.nodeSize, tableEnd)
            return true
        }),
        removeColumn: withSelectedTable(({ tr, node, pos }) => {
            if ((node.firstChild?.childCount ?? 0) <= 1) return false
            const deleteRanges: [number, number][] = []
            let rowPos = pos + 1
            node.forEach((row) => {
                if (row.childCount > 1) {
                    const lastCell = row.child(row.childCount - 1)
                    const rowEnd = rowPos + row.nodeSize - 1
                    deleteRanges.push([rowEnd - lastCell.nodeSize, rowEnd])
                }
                rowPos += row.nodeSize
            })
            for (const [from, to] of deleteRanges.reverse()) {
                tr.delete(from, to)
            }
            return true
        }),
    }
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
 * Convert the currently selected `chart` block into a `narrative-chart`
 * block referencing the given narrative chart, carrying over the embed
 * options (size, height, caption). Legal because both nodes are leaf atoms
 * with a single `props` attr. Returns the block's position, or null when
 * the selection is not a chart block. Undoable like any other transaction
 * (though undo does not delete the created narrative chart).
 */
export function convertSelectedChartBlockToNarrativeChart(
    editor: Editor,
    name: string
): number | null {
    const selection = editor.state.selection
    if (
        !(selection instanceof NodeSelection) ||
        selection.node.type.name !== pmNodeNames.chart
    )
        return null
    const pos = selection.from
    const chartProps = (selection.node.attrs.props ?? {}) as {
        size?: string
        height?: string
        caption?: unknown
    }
    const props: Record<string, unknown> = {
        name,
        size: chartProps.size ?? "wide",
    }
    if (chartProps.height !== undefined) props.height = chartProps.height
    if (chartProps.caption !== undefined) props.caption = chartProps.caption
    const applied = editor
        .chain()
        .command(({ tr, state }) => {
            tr.setNodeMarkup(
                pos,
                state.schema.nodes[pmNodeNames.narrativeChart],
                { props }
            )
            return true
        })
        .setNodeSelection(pos)
        .run()
    return applied ? pos : null
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
