import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { BlockFrame } from "./BlockFrame.js"

// NodeViews for the layout containers (two-column layouts, gray section,
// expandable paragraph). Their children stay fully editable via
// NodeViewContent; the BlockFrame adds the hover border for selecting,
// dragging and deleting the container as a whole.

function makeContainerBlockView(
    blockType: string,
    contentClassName: string
): (props: NodeViewProps) => React.ReactElement {
    return function ContainerBlockView(
        props: NodeViewProps
    ): React.ReactElement {
        return (
            <NodeViewWrapper
                className={`rich-container-block rich-container-block--${blockType}${
                    props.selected ? " rich-block--selected" : ""
                }`}
            >
                <BlockFrame nodeViewProps={props} label={blockType} />
                <NodeViewContent className={contentClassName} />
            </NodeViewWrapper>
        )
    }
}

export const StickyRightBlockView = makeContainerBlockView(
    "sticky-right",
    "rich-two-column__columns"
)
export const StickyLeftBlockView = makeContainerBlockView(
    "sticky-left",
    "rich-two-column__columns"
)
export const SideBySideBlockView = makeContainerBlockView(
    "side-by-side",
    "rich-two-column__columns"
)
export const GraySectionBlockView = makeContainerBlockView(
    "gray-section",
    "rich-container-block__content"
)
export const ExpandableParagraphBlockView = makeContainerBlockView(
    "expandable-paragraph",
    "rich-container-block__content"
)
