import { InnerBlocks, useBlockProps } from "@wordpress/block-editor"
import { registerBlockType } from "@wordpress/blocks"
import block from "./block.json"

const blockStyle = {
    border: "1px dashed lightgrey",
    padding: "0 1rem",
    marginBottom: "1rem",
}

const ExpandableParagraph = {
    edit: () => {
        const blockProps = useBlockProps({ style: blockStyle })

        return (
            <div {...blockProps}>
                <h3 style={{ color: "darkgrey" }}>Expandable paragraph</h3>
                <InnerBlocks
                    allowedBlocks={["core/paragraph", "core/heading"]}
                />
            </div>
        )
    },
    save: () => <InnerBlocks.Content />,
}

export const registerExpandableParagraph = () => {
    registerBlockType(block.name, ExpandableParagraph)
}
