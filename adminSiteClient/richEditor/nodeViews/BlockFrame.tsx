import { useState } from "react"
import { NodeViewProps, useEditorState } from "@tiptap/react"
import { NodeSelection } from "@tiptap/pm/state"

const EDGES = ["top", "right", "bottom", "left"] as const

/**
 * The selection and drag chrome shared by every block NodeView: a thin
 * border that appears when hovering the edges of the component. Clicking
 * the border selects the block (which opens its settings in the right
 * rail); the same edge area is the drag handle for reordering.
 */
export function BlockFrame(props: {
    nodeViewProps: NodeViewProps
    /** Block type shown in the label chip, e.g. "chart" */
    label: string
    /** Optional detail shown next to the label, e.g. the chart slug */
    summary?: string
}): React.ReactElement {
    const { nodeViewProps, label, summary } = props
    const [hovered, setHovered] = useState(false)

    // Whether this exact node is the NodeSelection target. NodeViewProps'
    // `selected` is true for every node *covered* by the selection, which
    // would light up all blocks nested inside a selected container.
    const isSelected = useEditorState({
        editor: nodeViewProps.editor,
        selector: ({ editor }) => {
            const selection = editor.state.selection
            return (
                selection instanceof NodeSelection &&
                selection.from === nodeViewProps.getPos()
            )
        },
    })

    const select = (): void => {
        const pos = nodeViewProps.getPos()
        if (pos === undefined) return
        nodeViewProps.editor.chain().focus().setNodeSelection(pos).run()
    }

    return (
        <div
            className={`rich-block-frame${
                hovered ? " rich-block-frame--hovered" : ""
            }${isSelected ? " rich-block-frame--selected" : ""}`}
            contentEditable={false}
        >
            <div className="rich-block-frame__ring" />
            <div className="rich-block-frame__label">
                {label}
                {summary ? (
                    <span className="rich-block-frame__summary">
                        {" "}
                        · {summary}
                    </span>
                ) : null}
            </div>
            {EDGES.map((edge) => (
                <div
                    key={edge}
                    className={`rich-block-frame__edge rich-block-frame__edge--${edge}`}
                    // draggable on the handle itself so containers (whose
                    // NodeView dom only becomes draggable once selected) can
                    // be dragged on first grab too
                    draggable
                    data-drag-handle
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                    onClick={select}
                />
            ))}
        </div>
    )
}
