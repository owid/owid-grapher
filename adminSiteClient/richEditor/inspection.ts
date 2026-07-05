import { Editor } from "@tiptap/core"
import { NodeSelection, Transaction } from "@tiptap/pm/state"
import { Node as PmNode, Schema } from "@tiptap/pm/model"
import {
    pmNodeNames,
    propsAtomBlockTypes,
    propsContainerBlockTypes,
    twoColumnBlockTypes,
} from "../../adminShared/richEditor/serialization/pmJson.js"

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

export interface InspectedKeyInsightsCommands {
    /** Append a slide (after the selected slide, or at the end) */
    addSlide: () => void
    /** Swap the selected slide with its previous/next sibling; unset at the ends */
    moveUp?: () => void
    moveDown?: () => void
}

export interface InspectedBlock {
    /** ProseMirror node type name */
    nodeType: string
    /** Enriched block type, e.g. "chart" */
    blockType: string
    /** Stable block id (blockId attr), null before assignment */
    blockId: string | null
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
    /** Slide commands, set for a selected key-insights block or slide */
    keyInsightsCommands?: InspectedKeyInsightsCommands
    /**
     * Convert this block into a narrative-chart block referencing the given
     * name; set only for chart blocks. Returns the block's position.
     */
    convertToNarrativeChart?: (name: string) => number | null
}

// Node types whose settings live in a `props` attr: the atoms, the props
// containers, and the key-insights container/slide pair
const nodeNameToPropsBlockType: Record<string, string> = {
    ...Object.fromEntries(
        Object.entries(propsAtomBlockTypes).map(([blockType, nodeName]) => [
            nodeName,
            blockType,
        ])
    ),
    ...Object.fromEntries(
        Object.entries(propsContainerBlockTypes).map(
            ([blockType, nodeName]) => [nodeName, blockType]
        )
    ),
    [pmNodeNames.keyInsights]: "key-insights",
    [pmNodeNames.keyInsightSlide]: "key-insight-slide",
}

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
    const blockId = (node.attrs.blockId as string | null) ?? null

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

    const propsBlockType = nodeNameToPropsBlockType[nodeType]
    if (propsBlockType) {
        return {
            nodeType,
            blockId,
            blockType: propsBlockType,
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
            ...(nodeType === pmNodeNames.keyInsights ||
            nodeType === pmNodeNames.keyInsightSlide
                ? { keyInsightsCommands: buildKeyInsightsCommands(editor) }
                : {}),
        }
    }

    const attrsBlockType = nodeNameToAttrsBlockType[nodeType]
    if (attrsBlockType) {
        // The block id is identity, not a setting: hide it from the
        // inspector form and survive full-attrs writes
        const { blockId: _blockIdAttr, ...attrsProps } = node.attrs
        return {
            nodeType,
            blockId,
            blockType: attrsBlockType,
            kind: "attrs",
            props: attrsProps as Record<string, unknown>,
            updateProps: updateSelectedNodeAttrs((attrs, newProps) => ({
                ...newProps,
                blockId: attrs.blockId ?? null,
            })),
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
            blockId,
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
            blockId,
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

// Slide edits on a selected key-insights block (append a slide) or slide
// (insert after, move up/down). Positions are computed from the live
// selection at call time; the new/moved slide is selected afterwards so the
// inspector follows it.
function buildKeyInsightsCommands(
    editor: Editor
): InspectedKeyInsightsCommands {
    const makeSlide = (schema: Schema): PmNode =>
        schema.nodes[pmNodeNames.keyInsightSlide].create(
            { props: { title: "" } },
            schema.nodes[pmNodeNames.paragraph].create()
        )

    const addSlide = (): void => {
        const current = editor.state.selection
        if (!(current instanceof NodeSelection)) return
        const name = current.node.type.name
        let insertPos: number
        if (name === pmNodeNames.keyInsights) {
            // append inside the container
            insertPos = current.from + current.node.nodeSize - 1
        } else if (name === pmNodeNames.keyInsightSlide) {
            // insert after the selected slide
            insertPos = current.from + current.node.nodeSize
        } else {
            return
        }
        editor
            .chain()
            .command(({ tr, state }) => {
                tr.insert(insertPos, makeSlide(state.schema))
                return true
            })
            .setNodeSelection(insertPos)
            .run()
    }

    const moveSlide = (delta: -1 | 1): void => {
        const current = editor.state.selection
        if (
            !(current instanceof NodeSelection) ||
            current.node.type.name !== pmNodeNames.keyInsightSlide
        )
            return
        const pos = current.from
        const $pos = editor.state.doc.resolve(pos)
        const index = $pos.index()
        const target = index + delta
        if (target < 0 || target >= $pos.parent.childCount) return
        const slide = current.node
        const sibling = $pos.parent.child(target)
        const newPos =
            delta === -1 ? pos - sibling.nodeSize : pos + sibling.nodeSize
        editor
            .chain()
            .command(({ tr }) => {
                tr.delete(pos, pos + slide.nodeSize)
                tr.insert(newPos, slide)
                return true
            })
            .setNodeSelection(newPos)
            .run()
    }

    // whether the selected slide has room to move, computed from the
    // selection the inspector was built for
    let canMoveUp = false
    let canMoveDown = false
    const selection = editor.state.selection
    if (
        selection instanceof NodeSelection &&
        selection.node.type.name === pmNodeNames.keyInsightSlide
    ) {
        const $pos = editor.state.doc.resolve(selection.from)
        canMoveUp = $pos.index() > 0
        canMoveDown = $pos.index() < $pos.parent.childCount - 1
    }

    return {
        addSlide,
        ...(canMoveUp ? { moveUp: () => moveSlide(-1) } : {}),
        ...(canMoveDown ? { moveDown: () => moveSlide(1) } : {}),
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
                // an in-place conversion keeps the block's identity
                { props, blockId: selection.node.attrs.blockId ?? null }
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
