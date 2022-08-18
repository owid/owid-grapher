import { InnerBlocks, useBlockProps } from "@wordpress/block-editor"
import { registerBlockType } from "@wordpress/blocks"
import block from "./block.json"

const blockStyle = {
    border: "1px dashed lightgrey",
    padding: "0 1rem",
    marginBottom: "1rem",
    color: "darkgrey",
}

const CodeSnippet = {
    edit: () => {
        const blockProps = useBlockProps({ style: blockStyle })

        return (
            <div {...blockProps}>
                <h3>Code snippet</h3>
                <InnerBlocks allowedBlocks={["core/code"]} />
            </div>
        )
    },
    save: () => <InnerBlocks.Content />,
}

export const registerCodeSnippet = () => {
    registerBlockType(block.name, CodeSnippet)
}
