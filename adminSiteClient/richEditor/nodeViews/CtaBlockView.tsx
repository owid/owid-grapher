import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { BlockFrame } from "./BlockFrame.js"

export function CtaBlockView(props: NodeViewProps): React.ReactElement {
    const { node, selected } = props
    const text = String(node.attrs.text ?? "")
    const url = String(node.attrs.url ?? "")

    return (
        <NodeViewWrapper
            className={`rich-atom-block rich-cta-block${
                selected ? " rich-block--selected" : ""
            }`}
        >
            <BlockFrame
                nodeViewProps={props}
                label="cta"
                summary={url || "no URL set"}
            />
            <div className="rich-cta-block__preview" contentEditable={false}>
                <span className="rich-cta-block__button">
                    {text || "Call to action"}
                </span>
            </div>
        </NodeViewWrapper>
    )
}
