import { InnerBlocks, useBlockProps } from "@wordpress/block-editor"
import { registerBlockType } from "@wordpress/blocks"
import block from "./block.json"

const blockStyle = {
    border: "1px dashed lightgrey",
    padding: "0 1rem",
}

const BLOCK_TEMPLATE = [
    [
        "core/columns",
        { columns: 2, className: "front-matter" },
        [
            ["core/column", {}, [["owid/expandable-paragraph"]]],
            [
                "core/column",
                {},
                [
                    ["core/button", { className: "btn-secondary" }],
                    [
                        "core/group",
                        { className: "related-topics" },
                        [["core/paragraph"], ["core/list"]],
                    ],
                ],
            ],
        ],
    ],
]

const FrontMatter = {
    edit: () => {
        return <InnerBlocks template={BLOCK_TEMPLATE} />
    },
    save: () => <InnerBlocks.Content />,
}

export const registerFrontMatter = () => {
    registerBlockType(block.name, FrontMatter)
}
