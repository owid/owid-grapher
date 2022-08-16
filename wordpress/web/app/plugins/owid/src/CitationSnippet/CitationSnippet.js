import { InnerBlocks, useBlockProps } from "@wordpress/block-editor"
import { registerBlockType } from "@wordpress/blocks"
import block from "./block.json"

const blockStyle = {
    border: "1px dashed lightgrey",
    padding: "0 1rem",
    marginBottom: "1rem",
    color: "darkgrey",
}

const CitationSnippet = {
    edit: () => {
        const blockProps = useBlockProps({ style: blockStyle })

        return (
            <div {...blockProps}>
                <h3>Citation snippet</h3>
                <InnerBlocks allowedBlocks={["core/code"]} />
            </div>
        )
    },
    save: () => <InnerBlocks.Content />,
}

export const registerCitationSnippet = () => {
    registerBlockType(block.name, CitationSnippet)
}
