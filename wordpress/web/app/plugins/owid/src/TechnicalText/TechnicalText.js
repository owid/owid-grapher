import { InnerBlocks, useBlockProps } from "@wordpress/block-editor"
import { registerBlockType } from "@wordpress/blocks"
import block from "./block.json"

const blockStyle = {
    border: "1px dashed lightgrey",
    padding: "0 1rem",
    marginBottom: "1rem",
}

const BLOCK_TEMPLATE = [["core/heading", { level: 5 }], ["core/paragraph"]]

const TechnicalText = {
    edit: () => {
        const blockProps = useBlockProps({ style: blockStyle })

        return (
            <div {...blockProps}>
                <InnerBlocks template={BLOCK_TEMPLATE} />
            </div>
        )
    },
    save: (props) => <InnerBlocks.Content />,
}

export const registerTechnicalText = () => {
    registerBlockType(block.name, TechnicalText)
}
