import { InnerBlocks, useBlockProps } from "@wordpress/block-editor"
import { registerBlockType } from "@wordpress/blocks"
import block from "./block.json"

const BLOCK_TEMPLATE = [
    [
        "core/heading",
        { content: "Cite our work", level: 4, anchor: "cite-our-work" },
    ],
    [
        "core/paragraph",
        {
            content:
                "Our articles and data visualizations rely on work from many different people and organizations.\nWhen citing this entry, please also cite the underlying data sources. This entry can be cited as:",
        },
    ],
    ["owid/citation-snippet"],
    ["core/heading", { content: "BibTeX citation", level: 5 }],
    ["owid/citation-snippet"],
]

const CitationSection = {
    edit: () => {
        const blockStyle = {
            border: "1px dashed lightgrey",
            padding: "0 1rem",
            marginBottom: "1rem",
        }
        const blockProps = useBlockProps({ style: blockStyle })

        return (
            <div {...blockProps}>
                <InnerBlocks template={BLOCK_TEMPLATE} />
            </div>
        )
    },
    save: () => <InnerBlocks.Content />,
}

export const registerCitationSection = () => {
    registerBlockType(block.name, CitationSection)
}
