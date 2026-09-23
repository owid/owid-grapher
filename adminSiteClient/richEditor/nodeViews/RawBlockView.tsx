import { useState } from "react"
import { Button, Tag } from "antd"
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"

/**
 * Read-only card for block types the editor doesn't support natively yet.
 * The block's JSON is carried through saves untouched, so exotic content
 * never becomes uneditable or lossy.
 */
export function RawBlockView(props: NodeViewProps): React.ReactElement {
    const { node, selected } = props
    const block = node.attrs.block as { type?: string } | null
    const [expanded, setExpanded] = useState(false)

    return (
        <NodeViewWrapper
            className={`rich-raw-block${selected ? " rich-block--selected" : ""}`}
            data-drag-handle
        >
            <div className="rich-block__toolbar" contentEditable={false}>
                <Tag color="orange">{block?.type ?? "unknown"}</Tag>
                <span className="rich-block__toolbar-info">
                    Not editable here yet — kept as-is when saving
                </span>
                <Button size="small" onClick={() => setExpanded(!expanded)}>
                    {expanded ? "Hide JSON" : "Show JSON"}
                </Button>
            </div>
            {expanded && (
                <pre className="rich-raw-block__json" contentEditable={false}>
                    {JSON.stringify(block, null, 2)}
                </pre>
            )}
        </NodeViewWrapper>
    )
}
