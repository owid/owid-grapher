import { InnerBlocks, useBlockProps } from "@wordpress/block-editor"
import { registerBlockType } from "@wordpress/blocks"
import block from "./block.json"

const blockStyle = {
    border: "1px dashed lightgrey",
    padding: "0 1rem",
    marginBottom: "1rem",
    color: "darkgrey",
}

const ExpandableParagraph = {
    edit: () => {
        const blockProps = useBlockProps({ style: blockStyle })

        return (
            <div {...blockProps}>
                <h3>Expandable paragraph</h3>
                <InnerBlocks allowedBlocks={["core/paragraph"]} />
            </div>
        )
    },
    save: () => <InnerBlocks.Content />,
}

export const registerExpandableParagraph = () => {
    registerBlockType(block.name, ExpandableParagraph)
}
