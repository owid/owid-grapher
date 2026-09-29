import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { BlockFrame } from "./BlockFrame.js"

/**
 * Read-only card for block types the editor doesn't support natively yet.
 * The block's JSON is carried through saves untouched, so exotic content
 * never becomes uneditable or lossy. Selecting the block shows its JSON in
 * the right rail.
 */
export function RawBlockView(props: NodeViewProps): React.ReactElement {
    const { node, selected } = props
    const block = node.attrs.block as { type?: string } | null

    return (
        <NodeViewWrapper
            className={`rich-atom-block rich-raw-block${
                selected ? " rich-block--selected" : ""
            }`}
        >
            <BlockFrame
                nodeViewProps={props}
                label={block?.type ?? "unknown"}
                summary="not editable here yet"
            />
            <div className="rich-raw-block__body" contentEditable={false}>
                [{block?.type ?? "unknown"}] — kept as-is when saving. Select
                this block to see its JSON in the right rail.
            </div>
        </NodeViewWrapper>
    )
}
